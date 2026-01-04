# /mesh/DAQ/lib/process.py
"""
DAQProcess
----------

Top-level process manager for the DAQ system. Wires together the gateway,
collector, and async handler chain (BSON → Compression → Pitcher).
"""

import asyncio
import os
import random
import shutil
import time
from datetime import datetime, time as dtime, timedelta, timezone, UTC
from bson import BSON
from DAQ.commands.protocol import Message, DataIndication
from DAQ.commands.strategy import CMD_FUNCS, MeshCommands
from DAQ.util.handlers.common import (
    BSONHandler,
    CompressionHandler,
    HandlerManager,
    IHandler,
)
from DAQ.services.core.data.pitcher import Pitcher
from DAQ.services.core.collector.collector import DeviceCollector
from DAQ.util.config import load_config
from DAQ.util.hex import _h
from DAQ.util.logger import make_logger
from DAQ.util.process.base import ProcessBase
from DAQ.gateway.manager import GatewayManager


cfg = load_config()
logger = make_logger("DAQProcess")

CMD_HANDLERS = {}


def handles(cmd_class):
    def decorator(fn):
        CMD_HANDLERS.setdefault(fn.__name__, []).append(cmd_class)
        return fn
    return decorator


def cleanup_temp_files():
    """Clean up stray multiprocessing temp files (legacy)."""
    for path in ["/tmp", "/dev/shm"]:
        for f in os.listdir(path):
            full = os.path.join(path, f)
            try:
                if os.path.isfile(full) or os.path.islink(full):
                    os.remove(full)
                elif os.path.isdir(full) and f.startswith("pymp-"):
                    shutil.rmtree(full, ignore_errors=True)
            except Exception:
                pass


def sunrise_today():
    today = datetime.now(UTC).date()
    return datetime.combine(today, dtime(6, 0), tzinfo=UTC)


class DAQProcess(ProcessBase, MeshCommands):
    MAX_REQUEST_ID = 65535

    def __init__(self):
        super().__init__()
        self.logger = make_logger(self.__class__.__name__)
        self._request_id = random.randrange(0, self.MAX_REQUEST_ID)
        self._make_map()
        self.sunrise = sunrise_today()
        self.requests = {}
        self.last_device_data = {}

        # Gateway
        self.recv_queue: asyncio.Queue = asyncio.Queue()
        self.gateway_manager = GatewayManager(
            cfg['gateway']['comm_host'],
            cfg['gateway']['comm_port'],
            self.recv_queue,
        )

        # Handler chain: BSON → Compression → Pitcher
        self.pitcher = Pitcher(IHandler.GENERIC)
        self.compression = CompressionHandler(IHandler.COMPILER)
        self.bson_handler = BSONHandler(IHandler.COMPILER)

        # Wire queues: bson → compression → pitcher
        self.bson_handler.processed_queue = self.compression.data_queue
        self.compression.processed_queue = self.pitcher.data_queue

        self.handler_manager = HandlerManager()
        self.handler_manager.add_handler(self.bson_handler)
        self.handler_manager.add_handler(self.compression)
        self.handler_manager.add_handler(self.pitcher)

        # Collector (devices → raw payloads)
        self.collector = DeviceCollector()
        self.collector_manager = HandlerManager()
        self.collector_manager.add_handler(self.collector)

        # Config
        self.throttle_delay = cfg.get("daq", {}).get("throttle_delay", 0.01)
        self.backpressure_threshold = cfg.get("daq", {}).get("backpressure_qsize", 10)

        # Configure compression
        try:
            comp_cfg = cfg.get("daq", {}).get("compression", {})
            self.compression.set('batch_on', comp_cfg.get("batch_on", 4))
            self.compression.set('batch_at', comp_cfg.get("batch_at", 0.5))
        except Exception as e:
            self.logger.exception("Failed to configure compression handler")

        # Configure collector devices
        try:
            devices_cfg = cfg['devices']['all']
            if isinstance(devices_cfg, (list, dict)):
                self.collector.set('devices', devices_cfg)
        except Exception as e:
            self.logger.warning("Could not set devices: %s", e)

        try:
            self.collector.set('convert_irradiance', cfg['devices']['convert_irradiance'])
        except Exception as e:
            self.logger.warning("Could not set irradiance conversion: %s", e)

    def _make_map(self):
        self.CMD_MAPPER = {name: getattr(self, name) for name in CMD_FUNCS if hasattr(self, name)}

    @property
    def request_id(self):
        self._request_id = (self._request_id + 1) % self.MAX_REQUEST_ID
        return self._request_id

    # ---------------------
    # Lifecycle
    # ---------------------

    async def start(self):
        self.logger.info("DAQProcess starting gateway and handlers")
        await self.gateway_manager.start()
        await self.handler_manager.start()
        await self.collector_manager.start()

    async def stop(self):
        self.logger.info("DAQProcess stopping...")
        try:
            await self.handler_manager.stop()
        except Exception:
            self.logger.exception("handler_manager stop failed")
        try:
            await self.collector_manager.stop()
        except Exception:
            self.logger.exception("collector_manager stop failed")
        try:
            await self.gateway_manager.stop()
        except Exception:
            self.logger.exception("gateway_manager stop failed")
        cleanup_temp_files()

    async def run(self):
        await self.start()
        try:
            self.logger.info("DAQProcess entering async run loop...")
            while True:
                payload = await self.recv_queue.get()
                await self.process_gateway_indication(payload)
        except asyncio.CancelledError:
            self.logger.info("DAQProcess cancelled.")
        finally:
            await self.stop()

    # ---------------------
    # Gateway Processing
    # ---------------------

    async def process_gateway_indication(self, payload):
        if isinstance(payload, dict):
            await self.bson_handler.data_queue.put(payload)
            return

        try:
            gwid, msg_type, length, raw, received_on = payload
        except Exception as e:
            self.logger.warning(f"Malformed gateway payload: {payload} ({e})")
            return

        if msg_type == Message.MESH_INDICATION:
            try:
                msg = Message.from_raw(msg_type, length, raw, received_on)
            except Exception:
                self.logger.critical(
                    "Unable to parse MESH_INDICATION: [%s,%s,%s]"
                    % (msg_type, length, _h(raw))
                )
                return
            for command in msg.commands:
                self.command_response(command, gwid)

        elif msg_type == Message.COMMAND_REQUEST:
            cmd_req = BSON(raw).decode()
            self.dispatch_command_request(cmd_req, gwid=gwid)

    def command_response(self, cmd, gwid=None):
        response = cmd.response()
        self.dispatch_command_handlers(cmd, response)

    def dispatch_command_request(self, cmd_req, gwid=None):
        func_name = cmd_req.get("func")
        args = cmd_req.get("args", {}) or {}
        func = self.CMD_MAPPER.get(func_name)
        if not func:
            self.logger.warning(f"[COMMAND] Unknown command: {func_name}")
            return {"status": False, "msg": "Unknown command"}
        try:
            return func(**args)
        except Exception as e:
            self.logger.exception(f"[COMMAND] Error executing {func_name}")
            return {"status": False, "msg": f"Error: {str(e)}"}

    def dispatch_command_handlers(self, cmd, response):
        handle_pass = True
        for handler_name, cmd_classes in CMD_HANDLERS.items():
            for klass in cmd_classes:
                if isinstance(cmd, klass):
                    func = getattr(self, handler_name, None)
                    if func:
                        try:
                            handle_pass = handle_pass and func(cmd, response)
                        except Exception as e:
                            self.logger.error(f"[{handler_name}] ERROR: {e}", exc_info=True)
        return handle_pass

    # ---------------------
    # Utilities
    # ---------------------

    def from_seconds_since_sunrise(self, seconds):
        return self.sunrise + timedelta(seconds=seconds)

    def to_seconds_since_sunrise(self, dt):
        return min(int((dt - self.sunrise).total_seconds()), 0xFFFE)

    # ---------------------
    # Command Handlers
    # ---------------------

    @handles(DataIndication)
    def handle_data_report(self, cmd, response):
        if 'reg_stat' not in response or 'op_stat' not in response:
            return False

        for data in response['data']:
            freezetime = self.from_seconds_since_sunrise(data['timestamp'])
            payload = dict(
                type=response['type'],
                macaddr=response['macaddr'],
                freezetime=freezetime,
                localtime=datetime.now(timezone.utc),
                reg_stat=response['reg_stat'],
                op_stat=response['op_stat'],
                Vi=data['Vi'],
                Vo=data['Vo'],
                Ii=data['Ii'],
                Io=data['Io'],
                Pi=data['Pi'],
                Po=data['Po'],
            )
            # Push through pipeline
            asyncio.create_task(self.bson_handler.data_queue.put(payload))
            self.last_device_data[payload['type']] = payload

        return True
