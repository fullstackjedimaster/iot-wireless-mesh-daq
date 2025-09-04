#!/usr/bin/env python3
import asyncio
import bz2
import signal
from bson import BSON, InvalidBSON
from datetime import datetime
import httpx  # ✅ added for microservice call
from apps.util.config import load_config, get_redis_conn, get_postgres_conn, get_topic
from apps.util.logger import make_logger
from apps.util.redis.access import GraphManager
from apps.util.daemon import Daemon
from apps.util.managers.nats_manager import nats_manager  # Centralized NATSManager

# ✅ fallback AI status logic
from apps.util.faults import compute_status_from_metrics

config = load_config()
logger = make_logger("Catcher")

DATA_TOPIC = get_topic("publish")
nats_manager.set_server(config["nats"]["server"])

shutdown_event = asyncio.Event()

def handle_signal(sig):
    logger.warning(f"[catcher] Received signal: {sig}. Initiating shutdown...")
    shutdown_event.set()


# Try to import get_ai_status dynamically if available
try:
    from apps.util.faults_ai import get_ai_status
    AI_STATUS_ENABLED = True
except ImportError:
    AI_STATUS_ENABLED = False
    async def get_ai_status(macaddr, voltage, current):
        # fallback inline
        return compute_status_from_metrics(voltage, current)

class MITTHandler:
    def __init__(self, redis_conn):
        self.throttle_delay = config.get("daq", {}).get("throttle_delay", 0.01)
        self.backpressure_threshold = config.get("daq", {}).get("backpressure_qsize", 10)
        self.redis_conn = redis_conn

    async def start(self):
        await nats_manager.connect()
        await nats_manager.nats.subscribe(DATA_TOPIC, cb=self.process_message)
        logger.info(f"[MITTHandler] Subscribed to topic: {DATA_TOPIC}")

    async def stop(self):
        logger.info("[MITTHandler] Stopping...")
        await nats_manager.disconnect()

    async def process_message(self, msg):
        try:
            decompressed = bz2.decompress(msg.data)
            data = BSON(decompressed).decode()
        except (InvalidBSON, OSError, ValueError) as e:
            logger.error(f"[MITTHandler] Invalid BSON: {e}")
            return

        if isinstance(data, dict) and "cache" in data:
            for item in data["cache"]:
                if isinstance(item, bytes):
                    try:
                        item = BSON(item).decode()
                    except Exception as e:
                        logger.warning(f"[MITTHandler] Skipping cached item: {e}")
                        continue
                await self.process_one_record(item)
        elif isinstance(data, dict):
            await self.process_one_record(data)
        else:
            logger.warning("[MITTHandler] Dropping unknown message format")

    async def process_one_record(self, payload: dict):
        if not isinstance(payload, dict):
            return

        raw_mac = payload.get("macaddr") or payload.get("monitor_mac")
        if isinstance(raw_mac, bytes):
            macaddr = raw_mac.decode("utf-8")
        else:
            macaddr = str(raw_mac)

        if not macaddr:
            logger.warning("[MITTHandler] No macaddr in payload")
            return

        def normalize_mac(raw):
            try:
                value = int(raw, 16)
                hex_str = f"{value:012x}"
                return ":".join(hex_str[i:i + 2] for i in range(0, 12, 2))
            except ValueError:
                return "invalid"

        normalized_mac = normalize_mac(macaddr)
        redis_key = f"sitearray:monitor:{normalized_mac}"

        try:
            voltage = payload.get("Vi") or 0.0
            current = payload.get("Ii") or 0.0
            power = payload.get("Pi") or 0.0
            temperature = payload.get("temperature") or 0.0

            # ✅ get status via AI microservice (or fallback)
            status = await get_ai_status(macaddr, voltage, current)

            values = {
                "voltage": voltage,
                "current": current,
                "power": power,
                "temperature": temperature,
                "status": status
            }

            cleaned = {k: str(v) for k, v in values.items() if isinstance(v, (str, int, float, bytes))}
            self.redis_conn.hset(redis_key, mapping=cleaned)
            logger.info(f"[MITTHandler] Updated Redis key {redis_key}")
        except Exception as e:
            logger.error(f"[MITTHandler] Failed to write Redis key {redis_key}: {e}")

class Catcher:
    def __init__(self, site="TEST", db=3):
        self.site = site
        self.db = db
        self.redis_conn = get_redis_conn(db=self.db)
        self.graph_mgr = GraphManager(client=self.redis_conn)
        self.handler = MITTHandler(redis_conn=self.redis_conn)

    async def start(self):
        logger.info(f"[Catcher] Registering site '{self.site}' in Redis db {self.db}")
        await self.handler.start()

    async def stop(self):
        await self.handler.stop()

async def run_catcher(site="TEST", db=3):
    catcher = Catcher(site, db)
    await catcher.start()

    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGTERM, lambda: handle_signal("SIGTERM"))
    loop.add_signal_handler(signal.SIGINT, lambda: handle_signal("SIGINT"))

    try:
        logger.info("[Catcher] Running...")
        await shutdown_event.wait()
    except asyncio.CancelledError:
        logger.info("[Catcher] Cancelled")
    finally:
        logger.info("[Catcher] Shutting down...")
        await catcher.stop()

class CatcherDaemon(Daemon):
    def run(self):
        logger.info("[CatcherDaemon] Starting")
        asyncio.run(run_catcher())

if __name__ == '__main__':
    try:
        asyncio.run(run_catcher())
    except Exception as e:
        logger.exception(f"[Catcher] Fatal error: {e}")
