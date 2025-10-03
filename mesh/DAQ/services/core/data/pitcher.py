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

        self._data_queue = None
        self._processed_queue = None

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

    async def mainloop(self):
        await self.connect()
        try:
            while not self._stop_event.is_set():
                try:
                    data = self._data_queue.get(timeout=1)
                    await self.publish(data)
                    await asyncio.sleep(self.throttle_delay)
                except queue.Empty:
                    await asyncio.sleep(0.05)
                except Exception as e:
                    self.logger.exception(f"[Pitcher] Publish failed: {e}")
        finally:
            await self.disconnect()

    async def start(self, data_queue=None, processed_queue=None):
        if data_queue is None:
            import queue
            data_queue = queue.Queue()
        if processed_queue is None:
            processed_queue = queue.Queue()

        self._data_queue = data_queue
        self._processed_queue = processed_queue
        self._loop = asyncio.get_running_loop()

        self._install_signal_handlers()
        self._task = self._loop.create_task(self.mainloop())

    async def stop(self):
        if not self._stop_event.is_set():
            self._stop_event.set()
        if self._task:
            await self._task
        self.logger.info("[Pitcher] Stopped gracefully")

    def _install_signal_handlers(self):
        loop = asyncio.get_running_loop()

        def _handle_signal(sig):
            self.logger.warning(f"[Pitcher] Received {sig.name}. Stopping...")
            self._stop_event.set()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, lambda s=sig: _handle_signal(s))
            except NotImplementedError:
                # Fallback for Windows
                signal.signal(sig, lambda *_: _handle_signal(sig))

    # ---- Legacy/Test Entry ----
    def worker(self, data_queue=None, processed_queue=None):
        """
        Synchronous/blocking wrapper for compatibility.
        Runs start() and stop() inside its own event loop.
        """
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self.start(data_queue, processed_queue))
            loop.run_until_complete(self._task)  # block until finished
        finally:
            if not loop.is_closed():
                loop.run_until_complete(self.stop())
                loop.close()
            self.logger.info("[Pitcher] Worker event loop closed")
