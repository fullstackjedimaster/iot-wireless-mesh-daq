import asyncio
import queue
import signal

from nats.aio.client import Client as NATS
from DAQ.util.handlers.common import IHandler
from DAQ.util.logger import make_logger
from DAQ.util.config import get_topic, load_config

cfg = load_config()
logger = make_logger("Pitcher")

external_server = cfg["nats"]["external_publish_server"]
external_topic = get_topic("external_mesh")

class Pitcher(IHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.logger = make_logger(self.__class__.__name__)
        self.ext_nats = NATS()
        self.connected = False
        self.subject = external_topic
        self.throttle_delay = cfg.get("daq", {}).get("throttle_delay", 0.01)
        self._loop = None
        self._task = None
        self._stop_event = asyncio.Event()

    async def connect(self):
        if not self.connected:
            await self.ext_nats.connect(servers=[external_server])
            self.connected = True
            self.logger.info(f"[Pitcher] Connected to external NATS at {external_server}")

    async def disconnect(self):
        if self.connected:
            await self.ext_nats.close()
            self.logger.info("[Pitcher] Disconnected from NATS")
            self.connected = False

    async def publish(self, payload: bytes):
        await self.ext_nats.publish(self.subject, payload)
        self.logger.info(f"[Pitcher] Published {len(payload)} bytes to: {self.subject}")

    async def mainloop(self, data_queue, processed_queue):
        await self.connect()
        try:
            while not self._stop_event.is_set():
                try:
                    data = data_queue.get(timeout=1)
                    await self.publish(data)
                    await asyncio.sleep(self.throttle_delay)
                except queue.Empty:
                    await asyncio.sleep(0.05)
                except Exception as e:
                    self.logger.exception(f"[Pitcher] Publish failed: {e}")
        finally:
            await self.disconnect()

    def stop(self):
        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._stop_event.set)

    def worker(self, data_queue, processed_queue):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        def handle_signal(signum, frame):
            self.logger.warning(f"[Pitcher] Received signal {signum}. Stopping...")
            self._loop.call_soon_threadsafe(self._stop_event.set)

        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)

        try:
            self._loop.run_until_complete(self.mainloop(data_queue, processed_queue))
        finally:
            self._loop.close()
            self.logger.info("[Pitcher] Event loop closed")
