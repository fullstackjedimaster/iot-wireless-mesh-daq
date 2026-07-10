#!/usr/bin/env python3

from __future__ import annotations

import asyncio
import signal
import sys

from bootstrap_path import add_project_root

add_project_root()

from apps.mitt.catcher import Catcher
from apps.util.logger import make_logger
from apps.util.managers.nats_manager import nats_manager

logger = make_logger("run_catcher")
shutdown_event = asyncio.Event()


def emit(message: str) -> None:
    print(message, file=sys.stdout, flush=True)


def handle_signal(signal_name: str) -> None:
    emit(f"[run_catcher] Received {signal_name}; shutting down.")
    logger.warning(
        "[run_catcher] Received %s; shutting down.",
        signal_name,
    )
    shutdown_event.set()


async def main() -> None:
    emit("[run_catcher] Python process started.")

    loop = asyncio.get_running_loop()

    for signal_value, signal_name in (
        (signal.SIGTERM, "SIGTERM"),
        (signal.SIGINT, "SIGINT"),
    ):
        loop.add_signal_handler(
            signal_value,
            lambda name=signal_name: handle_signal(name),
        )

    emit("[run_catcher] Connecting catcher...")

    catcher = Catcher()
    await catcher.start()

    emit("[run_catcher] Catcher started and waiting for NATS messages.")
    logger.info(
        "[run_catcher] Catcher started and waiting for NATS messages."
    )

    try:
        await shutdown_event.wait()
    finally:
        emit("[run_catcher] Stopping catcher...")

        try:
            await catcher.stop()
        except Exception:
            logger.exception("[run_catcher] catcher.stop() failed")

        try:
            await nats_manager.disconnect()
        except Exception:
            logger.exception(
                "[run_catcher] NATS disconnect failed"
            )

        emit("[run_catcher] Shutdown complete.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:
        emit(f"[run_catcher] Fatal error: {exc!r}")
        logger.exception("[run_catcher] Fatal error")
        raise

# #!/usr/bin/env python3
# from __future__ import annotations
#
# import asyncio
# import signal
#
# from bootstrap_path import add_project_root
#
# add_project_root()
#
# from apps.mitt.catcher import Catcher
# from apps.util.logger import make_logger
#
# logger = make_logger("run_catcher")
# shutdown_event = asyncio.Event()
#
#
# def handle_signal(signal_name: str) -> None:
#     logger.warning("[run_catcher] Caught %s; shutting down...", signal_name)
#     shutdown_event.set()
#
#
# async def main() -> None:
#     logger.info("[run_catcher] Starting Catcher process...")
#
#     loop = asyncio.get_running_loop()
#     for sig in (signal.SIGTERM, signal.SIGINT):
#         loop.add_signal_handler(sig, handle_signal, sig.name)
#
#     catcher = Catcher()
#     await catcher.start()
#
#     try:
#         logger.info("[run_catcher] Catcher started; waiting for messages...")
#         await shutdown_event.wait()
#     finally:
#         logger.info("[run_catcher] Stopping Catcher...")
#         try:
#             await catcher.stop()
#         except Exception:
#             logger.exception("[run_catcher] catcher.stop() failed")
#         logger.info("[run_catcher] Shutdown complete.")
#
#
# if __name__ == "__main__":
#     try:
#         asyncio.run(main())
#     except KeyboardInterrupt:
#         pass
#     except Exception:
#         logger.exception("[run_catcher] Fatal error")
#         raise
