#!/usr/bin/env python3
import asyncio
import signal
from bootstrap_path import add_project_root

# ✅ Ensure all imports resolve from cloud root
add_project_root()

from apps.mitt.catcher import Catcher
from apps.util.logger import make_logger
from apps.util.managers.nats_manager import nats_manager

logger = make_logger("run_catcher")

# Graceful shutdown state
shutdown_event = asyncio.Event()

def handle_signal(sig):
    logger.warning(f"[run_catcher] Caught signal: {sig}. Shutting down...")
    shutdown_event.set()

async def main():
    logger.info("[run_catcher] Starting Catcher process...")

    # Trap termination signals
    loop = asyncio.get_running_loop()
    loop.add_signal_handler(signal.SIGTERM, lambda: handle_signal("SIGTERM"))
    loop.add_signal_handler(signal.SIGINT, lambda: handle_signal("SIGINT"))

    # Optional: override NATS server if needed
    # nats_manager.set_server("nats://localhost:4222")

    await nats_manager.connect()

    catcher = Catcher()
    await catcher.start()

    try:
        logger.info("[run_catcher] Running until shutdown signal received...")
        await shutdown_event.wait()
    finally:
        logger.info("[run_catcher] Cleaning up...")
        try:
            await catcher.stop()
        except Exception as e:
            logger.warning(f"[run_catcher] catcher.stop() failed: {e}")
        try:
            await nats_manager.disconnect()
        except Exception as e:
            logger.warning(f"[run_catcher] nats_manager.disconnect() failed: {e}")
        logger.info("[run_catcher] Shutdown complete.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.exception(f"[run_catcher] Fatal error: {e}")
