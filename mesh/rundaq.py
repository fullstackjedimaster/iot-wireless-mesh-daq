#!/usr/bin/env python3
"""
rundaq.py - Launches the DAQ system:
- Starts internal and external NATS servers
- Launches DAQProcess
- Ensures singleton execution and graceful shutdown
"""

import asyncio
import subprocess
import logging
import os
import atexit
import signal
import sys
import fcntl

from DAQ.util.logger import make_logger
from DAQ.lib.process import DAQProcess

logger = make_logger("rundaq")

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s] %(levelname)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

def acquire_lock():
    lockfile_path = '/tmp/rundaq.lock'
    lockfile = open(lockfile_path, 'w')
    try:
        fcntl.lockf(lockfile, fcntl.LOCK_EX | fcntl.LOCK_NB)
        logger.info(f"[rundaq] Acquired singleton lock: {lockfile_path}")
    except IOError:
        logger.error("[rundaq] Another instance is already running.")
        sys.exit(1)


def shutdown():
  pass

async def run_daq():
    logger.info(f"[rundaq] Running with PID={os.getpid()} UID={os.getuid()} CWD={os.getcwd()}")
    logger.info("[rundaq] Launching DAQProcess...")
    daq = DAQProcess()
    await daq.run()

def main():
    setup_logging()
    acquire_lock()
    atexit.register(shutdown)

    # Also trap TERM/INT signals to shut down properly
    signal.signal(signal.SIGTERM, lambda sig, frame: sys.exit(0))
    signal.signal(signal.SIGINT, lambda sig, frame: sys.exit(0))

    try:
        asyncio.run(run_daq())
    except KeyboardInterrupt:
        logger.info("[rundaq] KeyboardInterrupt caught. Exiting.")

if __name__ == "__main__":
    main()
