import asyncio
import logging
from DAQ.services.core.data.pitcher import Pitcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("run_pitcher")

async def main():
    pitcher = Pitcher()
    try:
        # start pitcher (whatever async setup you’ve got)
        await pitcher.start()
        logger.info("Pitcher started and running.")
        # Sleep forever until cancelled
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        logger.info("Cancellation requested, shutting down.")
    except Exception:
        logger.exception("Fatal error in run_pitcher")
    finally:
        try:
            pitcher.stop()  # sync stop, signals loop to exit
        except Exception:
            logger.exception("Error during pitcher.stop()")
        else:
            logger.info("Pitcher stopped.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt at top level.")
