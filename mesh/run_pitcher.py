import asyncio
import logging
from DAQ.services.core.data.pitcher import Pitcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_pitcher")

async def main():
    pitcher = Pitcher()
    try:
        await pitcher.start()
        logger.info("Pitcher started and running.")
        await asyncio.Event().wait()  # blocks until SIGTERM/SIGINT
    except asyncio.CancelledError:
        logger.info("Cancellation requested, shutting down.")
    except Exception:
        logger.exception("Fatal error in run_pitcher")
    finally:
        await pitcher.stop()
        logger.info("Pitcher stopped.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt at top level.")
