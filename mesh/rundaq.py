#!/usr/bin/env python3
"""
rundaq.py - Launches the DAQ system:
- Ensures singleton execution via lock file
- Launches DAQProcess with graceful shutdown
"""

import asyncio
import logging
import os
import atexit
import signal
import sys
import fcntl

from DAQ.util.logger import make_logger
from DAQ.lib.process import DAQProcess

logger = make_logger("rundaq")

# Global references
lockfile = None
daq: DAQProcess | None = None
shutdown_event = asyncio.Event()

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def acquire_lock():
    global lockfile
    lockfile_path = '/tmp/rundaq.lock'
    lockfile = open(lockfile_path, 'w')
    try:
        fcntl.lockf(lockfile, fcntl.LOCK_EX | fcntl.LOCK_NB)
        logger.info(f"[rundaq] Acquired singleton lock: {lockfile_path}")
    except IOError:
        logger.error("[rundaq] Another instance is already running.")
        sys.exit(1)

def release_lock():
    global lockfile
    if lockfile:
        try:
            fcntl.lockf(lockfile, fcntl.LOCK_UN)
            lockfile.close()
            logger.info("[rundaq] Released singleton lock.")
        except Exception as e:
            logger.warning(f"[rundaq] Failed to release lock cleanly: {e}")

async def run_daq():
    global daq
    logger.info(f"[rundaq] Running with PID={os.getpid()} UID={os.getuid()} CWD={os.getcwd()}")
    daq = DAQProcess()
    await daq.run()

def handle_signal(sig, frame):
    logger.warning(f"[rundaq] Caught signal {sig}. Shutting down...")
    shutdown_event.set()

async def main_async():
    # Trap shutdown signals
    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGTERM, lambda: handle_signal("SIGTERM", None))
    loop.add_signal_handler(signal.SIGINT, lambda: handle_signal("SIGINT", None))

    # Start DAQ
    daq_task = asyncio.create_task(run_daq())

    # Wait until shutdown triggered
    await shutdown_event.wait()

    # Attempt clean shutdown
    if daq and hasattr(daq, "stop"):
        try:
            await daq.stop()
            logger.info("[rundaq] DAQProcess stopped cleanly.")
        except Exception as e:
            logger.error(f"[rundaq] Error stopping DAQProcess: {e}")

    daq_task.cancel()
    try:
        await daq_task
    except asyncio.CancelledError:
        logger.info("[rundaq] DAQ task cancelled.")

def main():
    setup_logging()
    acquire_lock()
    atexit.register(release_lock)

    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logger.info("[rundaq] KeyboardInterrupt caught. Exiting.")
    finally:
        release_lock()

if __name__ == "__main__":
    main()
