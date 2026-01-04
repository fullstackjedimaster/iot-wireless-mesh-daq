#!/usr/bin/env python3
"""
rundaq.py - Launches the DAQ system
-----------------------------------

- Ensures singleton execution via lock file
- Launches DAQProcess under asyncio
- Handles graceful shutdown on SIGINT/SIGTERM
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


# ---------------------
# Locking
# ---------------------

def acquire_lock():
    """Ensure singleton execution via lock file."""
    global lockfile
    lockfile_path = "/tmp/rundaq.lock"
    lockfile = open(lockfile_path, "w")
    try:
        fcntl.lockf(lockfile, fcntl.LOCK_EX | fcntl.LOCK_NB)
        logger.info(f"[rundaq] Acquired singleton lock: {lockfile_path}")
    except IOError:
        logger.error("[rundaq] Another instance is already running.")
        sys.exit(1)


def release_lock():
    """Release the singleton lock file on exit."""
    global lockfile
    if lockfile:
        try:
            fcntl.lockf(lockfile, fcntl.LOCK_UN)
            lockfile.close()
            logger.info("[rundaq] Released singleton lock.")
        except Exception as e:
            logger.warning(f"[rundaq] Failed to release lock cleanly: {e}")


# ---------------------
# Async DAQ Lifecycle
# ---------------------

async def run_daq():
    """Create and run the DAQ process until cancelled."""
    global daq
    logger.info(
        f"[rundaq] Running with PID={os.getpid()} UID={os.getuid()} CWD={os.getcwd()}"
    )
    daq = DAQProcess()
    await daq.run()


def handle_signal(sig: str):
    """Signal handler for clean shutdown."""
    logger.warning(f"[rundaq] Caught signal {sig}. Shutting down...")
    shutdown_event.set()


async def main_async():
    # Trap shutdown signals
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda s=sig: handle_signal(s.name))

    # Start DAQ as a background task
    daq_task = asyncio.create_task(run_daq(), name="DAQProcessTask")

    # Wait until shutdown triggered
    await shutdown_event.wait()

    # Attempt clean shutdown
    if daq and hasattr(daq, "stop"):
        try:
            await daq.stop()
            logger.info("[rundaq] DAQProcess stopped cleanly.")
        except Exception as e:
            logger.error(f"[rundaq] Error stopping DAQProcess: {e}")

    # Cancel main DAQ loop
    daq_task.cancel()
    try:
        await daq_task
    except asyncio.CancelledError:
        logger.info("[rundaq] DAQ task cancelled.")


# ---------------------
# Entrypoint
# ---------------------

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


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
