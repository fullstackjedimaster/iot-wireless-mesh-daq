import asyncio
import bz2
from bson import BSON
import multiprocessing
import os
import queue
import signal
import time
import uuid
from multiprocessing import util
from multiprocessing.managers import SyncManager
from app.util.hex import _h
from app.util.logger import make_logger
from app.util.utctime import utcepochnow
from app.util.config import get_topic
from app.util.brokers.broker import local_nats_broker

# ---------------------
# Signal-Ignoring Manager
# ---------------------

class IgnoreSignalManager(SyncManager):
    @classmethod
    def _run_server(cls, registry, address, authkey, serializer, writer,
                    initializer=None, initargs=()):
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        signal.signal(signal.SIGCHLD, signal.SIG_IGN)

        if initializer:
            initializer(*initargs)

        server = cls._Server(registry, address, authkey, serializer)
        writer.send(server.address)
        writer.close()

        util.info('manager serving at %r', server.address)
        server.serve_forever()

# ---------------------
# Handler Management
# ---------------------

class HandlerManager:
    def __init__(self):
        self.manager = IgnoreSignalManager()
        self.manager.start()
        self.state = self.manager.dict()
        self.handlers = set()

    def add_handler(self, handler):
        if handler not in self.handlers:
            self.handlers.add(handler)
            handler.state = self.state
            for sub in handler.subhandlers:
                self.add_handler(sub)

    def set_input_queue(self, queue):
        for handler in self.handlers:
            handler.data_queue = queue

    def start(self):
        for handler in self.handlers:
            handler.start()

    def stop(self):
        for handler in self.handlers:
            handler.stop()

# ---------------------
# Handler Interface
# ---------------------

class IHandler:
    GENERIC = 0
    COMPILER = 1
    DECOMPILER = 2
    JOIN_TIMEOUT = 30

    def __init__(self, handler_type=GENERIC, clean_stop=True, **kwargs):
        self.data_queue = multiprocessing.Queue()
        self.processed_queue = multiprocessing.Queue()
        self.process = None
        self.subhandlers = []
        self.kwargs = kwargs
        self.handler_type = handler_type
        self.clean_stop = clean_stop
        self._id = _h(str(uuid.uuid4()).encode())[:4]
        self.name = self.__class__.__name__
        self.ppid = os.getpid()
        self.logger = make_logger(f"{self.name}:{self.ppid}:{self._id}")
        self._living = multiprocessing.Event()

    def _dispatch(self, target):
        def _exc(data_queue, processed_queue):
            self.logger = make_logger(f"{self.name}:{os.getpid()}")
            signal.signal(signal.SIGINT, signal.SIG_IGN)
            signal.signal(signal.SIGCHLD, signal.SIG_IGN)

            try:
                target(data_queue, processed_queue)
            except Exception as e:
                self.logger.error(f"Handler error: {e}")
                if not self.clean_stop:
                    raise
            finally:
                self.logger.close()
        return _exc

    def _mkprocess(self):
        if self.handler_type == IHandler.GENERIC:
            target = self.worker
        elif self.handler_type == IHandler.COMPILER:
            target = self.compile
        elif self.handler_type == IHandler.DECOMPILER:
            target = self.decompile

        self._living = multiprocessing.Event()
        self.process = multiprocessing.Process(
            target=self._dispatch(target),
            args=(self.data_queue, self.processed_queue),
            name=self.name
        )
        self.process.daemon = True

    def _check_living(self):
        return self._living.is_set() and os.getppid() == self.ppid

    def start(self, subhandlers=True):
        if not self._living.is_set():
            self.logger.debug("Starting handler...")
            self._mkprocess()
            self._living.set()
            self.process.start()
            self.logger.info(f"PID: {self.process.pid}; TYPE: {self.handler_type}")
            if subhandlers:
                for handler in self.subhandlers:
                    handler.start()

    def stop(self, subhandlers=True, terminate=False, join=True):
        if self.process is None:
            return

        self._living.clear()

        if join:
            self.process.join(self.JOIN_TIMEOUT)

        if subhandlers:
            for handler in self.subhandlers:
                handler.stop()

        if join and self.process.is_alive():
            os.kill(self.process.pid, signal.SIGKILL)

        self.process = None
        self.logger.debug("Handler stopped")

    def is_alive(self):
        return self.process and self.process.is_alive()

    def is_stack_alive(self):
        return self.is_alive() and all(h.is_stack_alive() for h in self.subhandlers)

    def get_dead_handlers(self):
        dead = []
        if not self.is_alive():
            dead.append(self)
        for h in self.subhandlers:
            dead.extend(h.get_dead_handlers())
        return dead

    def loop(self, *_):
        self.set('heartbeat', utcepochnow())

    def add_subhandler(self, subhandler):
        if subhandler not in self.subhandlers:
            self.subhandlers.append(subhandler)
        if not isinstance(subhandler, IStateHandler):
            self.processed_queue = subhandler.data_queue

    def __call__(self, subhandler):
        self.add_subhandler(subhandler)
        return self

    def _kw(self, key):
        return f"{self.name}.{self._id}.{key}"

    def set(self, key, value):
        assert hasattr(self, 'state'), "Handler must be connected to a HandlerManager"
        self.state[self._kw(key)] = value

    def get(self, key, default=None):
        return self.state.get(self._kw(key), default)

    def worker(self, data_queue, processed_queue):
        raise NotImplementedError

    def compile(self, data_queue, processed_queue):
        return self.worker(data_queue, processed_queue)

    def decompile(self, data_queue, processed_queue):
        return self.worker(data_queue, processed_queue)

# ---------------------
# State-only Handler
# ---------------------

class IStateHandler(IHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.data_queue = None
        self.processed_queue = None

    def _mkprocess(self):
        self.process = multiprocessing.Process(
            target=self._dispatch(self.state_modifier),
            name=self.name
        )
        self.process.daemon = True

# ---------------------
# Basic Handlers
# ---------------------

class PassthroughHandler(IHandler):
    def worker(self, data_queue, processed_queue):
        while self._check_living():
            data = data_queue.get()
            processed_queue.put(data)
            self.loop(data_queue, processed_queue)

class PrintHandler(IHandler):
    def worker(self, data_queue, processed_queue):
        while self._check_living():
            data = data_queue.get()
            self.logger.info(f"{data}")
            self.loop(data_queue, processed_queue)

# ---------------------
# BSON Handler
# ---------------------

class BSONHandler(IHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.logger = make_logger("BSONHandler")

    def encode(self, payload: dict) -> bytes:
        if not isinstance(payload, dict):
            self.logger.warning(f"[BSON] Invalid payload type: {type(payload)}")
            return b''

        try:
            encoded = BSON.encode(payload)
            # Optional test
            try:
                _ = BSON(encoded).decode()
            except Exception as e:
                self.logger.warning(f"[BSON] Self-test decode failed: {e}")

            self.logger.info(f"[BSON] Encoding payload: {payload}")
            return encoded
        except Exception as e:
            self.logger.error(f"[BSON] Encoding failed: {e}")
            return b''

    def worker(self, data_queue, processed_queue):
        while self._check_living():
            try:
                payload = data_queue.get(timeout=1)
                if not isinstance(payload, dict):
                    self.logger.warning(f"[BSON] Skipping non-dict payload: {type(payload)}")
                    continue
                encoded = self.encode(payload)
                processed_queue.put(encoded)
            except queue.Empty:
                time.sleep(0.1)

# ---------------------
# Compression Handler
# ---------------------

class CompressionHandler(IHandler):
    def compile(self, data_queue, processed_queue):
        cache = {'cache': [], 'last_processed': time.time()}
        self.state['num_records'] = 0

        while self._check_living():
            try:
                data = data_queue.get(timeout=5)
                cache['cache'].append(data)
            except queue.Empty:
                pass

            if cache['cache'] and (
                len(cache['cache']) >= self.get('batch_on', 500) or
                time.time() - cache['last_processed'] >= self.get('batch_at', 60)
            ):
                self.logger.info(f"[COMPRESS] Compressing {len(cache['cache'])} records")
                self.state['num_records'] = max(self.state['num_records'], len(cache['cache']))
                processed_queue.put(bz2.compress(BSON.encode(cache)))
                cache = {'cache': [], 'last_processed': time.time()}

            self.loop(data_queue, processed_queue)

    def decompile(self, data_queue, processed_queue):
        while self._check_living():
            try:
                meta, rdata = data_queue.get(timeout=5)
                cache = BSON(bz2.decompress(rdata)).decode()

                for item in cache.get('cache', []):
                    processed_queue.put((meta, item))
            except (queue.Empty, OSError, ValueError, BSON.errors.BSONError):
                continue
            self.loop(data_queue, processed_queue)

# ---------------------
# NATS Handler
# ---------------------

class NATSHandler(IHandler):
    def __init__(self, subject=None, **kwargs):
        super().__init__(**kwargs)
        self.logger = make_logger(self.__class__.__name__)
        self.subject = subject or get_topic("internal_mesh")
        self.connected = False

    async def connect(self):
        if not local_nats_broker.connected:
            await local_nats_broker.connect()
        self.connected = True

    async def publish(self, data: bytes):
        if not local_nats_broker.connected:
            self.logger.warning("[NATS] Not connected")
            return

        self.logger.info(f"[PITCHER] Publishing to NATS → {self.subject} | {len(data)} bytes")
        await local_nats_broker.publish(self.subject, data)

    def worker(self, data_queue, processed_queue):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def mainloop():
            await self.connect()
            while self._check_living():
                try:
                    data = data_queue.get(timeout=1)
                    await self.publish(data)
                except queue.Empty:
                    await asyncio.sleep(0.1)

        try:
            loop.run_until_complete(mainloop())
        finally:
            loop.run_until_complete(local_nats_broker.close())
            self.connected = False
            loop.close()
