# /mesh/DAQ/services/core/data/pitcher.py
"""
Pitcher Handler
---------------

Async handler that publishes payloads to an external NATS server.
Designed to integrate with the async handler framework (IHandler).
"""

import asyncio
from nats.aio.client import Client as NATS
from DAQ.util.handlers.common import IHandler
from DAQ.util.logger import make_logger
from DAQ.util.config import get_topic, load_config


cfg = load_config()
logger = make_logger("Pitcher")

external_server = cfg["nats"]["external_publish_server"]
external_topic = get_topic("external_mesh")


class Pitcher(IHandler):
    """Publishes messages from its data_queue to an external NATS subject."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.logger = make_logger(self.__class__.__name__)
        self.ext_nats = NATS()
        self.connected = False
        self.subject = external_topic
        self.throttle_delay = cfg.get("daq", {}).get("throttle_delay", 0.01)

    async def connect(self):
        if not self.connected:
            await self.ext_nats.connect(servers=[external_server])
            self.connected = True
            self.logger.info(f"[Pitcher] Connected to external NATS at {external_server}")

    async def disconnect(self):
        if self.connected:
            try:
                await self.ext_nats.close()
            except Exception as e:
                self.logger.error(f"[Pitcher] Error while disconnecting: {e}", exc_info=True)
            self.connected = False
            self.logger.info("[Pitcher] Disconnected from NATS")

    async def run(self):
        await self.connect()
        try:
            while self._running:
                try:
                    # Wait for next payload
                    payload = await asyncio.wait_for(self.data_queue.get(), timeout=1.0)
                    if not isinstance(payload, (bytes, bytearray)):
                        self.logger.warning(f"[Pitcher] Skipping non-bytes payload: {type(payload)}")
                        continue
                    await self.ext_nats.publish(self.subject, payload)
                    self.logger.debug(f"[Pitcher] Published {len(payload)} bytes → {self.subject}")
                    await asyncio.sleep(self.throttle_delay)
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    self.logger.error(f"[Pitcher] Publish failed: {e}", exc_info=True)
                    await asyncio.sleep(1.0)  # backoff before retry
        finally:
            await self.disconnect()
