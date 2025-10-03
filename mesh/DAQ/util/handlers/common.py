# /mesh/DAQ/util/handlers/common.py
"""
Async Handler Framework for DAQ System
--------------------------------------

This module provides a fully async replacement for the legacy multiprocessing
handler framework. It defines a base IHandler class, a HandlerManager for orchestration,
and concrete handlers like BSONHandler and CompressionHandler.

All handlers are asyncio-native and use asyncio.Queue for data flow.
"""

import asyncio
import time
import bz2
from bson import BSON
from DAQ.util.logger import make_logger
from DAQ.util.utctime import utcepochnow


# ---------------------
# HandlerManager
# ---------------------

class HandlerManager:
    """Manages a set of async IHandler instances."""

    def __init__(self):
        self.handlers = []

    def add_handler(self, handler):
        if handler not in self.handlers:
            self.handlers.append(handler)

    async def start(self):
        for handler in self.handlers:
            await handler.start()

    async def stop(self):
        for handler in self.handlers:
            await handler.stop()


# ---------------------
# IHandler
# ---------------------

class IHandler:
    """Base async handler class."""

    GENERIC = 0
    COMPILER = 1
    DECOMPILER = 2

    def __init__(self, handler_type=GENERIC, **kwargs):
        self.handler_type = handler_type
        self.kwargs = kwargs
        self.logger = make_logger(self.__class__.__name__)
        self.state = {}

        # Async data flow
        self.data_queue: asyncio.Queue = asyncio.Queue()
        self.processed_queue: asyncio.Queue = asyncio.Queue()

        # Internal lifecycle
        self._task: asyncio.Task | None = None
        self._running: bool = False

    async def start(self):
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self.run(), name=f"{self.__class__.__name__}.task")
            self.logger.info(f"{self.__class__.__name__} started.")

    async def stop(self):
        if self._running:
            self._running = False
            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
            self.logger.info(f"{self.__class__.__name__} stopped.")

    async def run(self):
        """Override this in subclasses."""
        raise NotImplementedError

    def loop(self, *_):
        """Heartbeat hook for subclasses."""
        self.set('heartbeat', utcepochnow())

    def set(self, key, value):
        self.state[key] = value

    def get(self, key, default=None):
        return self.state.get(key, default)


# ---------------------
# IStateHandler
# ---------------------

class IStateHandler(IHandler):
    """Special handler type that applies a state modifier."""

    async def run(self):
        if not hasattr(self, "state_modifier") or not callable(self.state_modifier):
            raise NotImplementedError(
                f"{self.__class__.__name__} must implement an async 'state_modifier' method."
            )
        await self.state_modifier()


# ---------------------
# BSON Handler
# ---------------------

class BSONHandler(IHandler):
    """Encodes dict payloads into BSON."""

    async def run(self):
        while self._running:
            try:
                payload = await self.data_queue.get()
                if not isinstance(payload, dict):
                    self.logger.warning(f"[BSON] Skipping non-dict payload: {type(payload)}")
                    continue
                encoded = self.encode(payload)
                await self.processed_queue.put(encoded)
                self.logger.debug(f"[BSON] Encoded payload of size {len(encoded)} bytes")
            except Exception as e:
                self.logger.error(f"[BSON] Error: {e}", exc_info=True)

    def encode(self, payload: dict) -> bytes:
        return BSON.encode(payload)


# ---------------------
# Compression Handler
# ---------------------

class CompressionHandler(IHandler):
    """Compresses batches of BSON-encoded payloads."""

    async def run(self):
        cache = {'cache': [], 'last_processed': time.time()}
        while self._running:
            try:
                data = await asyncio.wait_for(self.data_queue.get(), timeout=1.0)
                cache['cache'].append(data)
            except asyncio.TimeoutError:
                pass

            batch_on = self.get('batch_on', 500)
            batch_at = self.get('batch_at', 60)

            if cache['cache'] and (
                    len(cache['cache']) >= batch_on
                    or time.time() - cache['last_processed'] >= batch_at
            ):
                reason = "size" if len(cache['cache']) >= batch_on else "time"
                self.logger.info(f"[COMPRESS] Compressing {len(cache['cache'])} records due to {reason}")
                try:
                    compressed = bz2.compress(BSON.encode(cache))
                    await self.processed_queue.put(compressed)
                except Exception as e:
                    self.logger.error(f"[COMPRESS] Failed to compress batch: {e}", exc_info=True)
                cache = {'cache': [], 'last_processed': time.time()}
