#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import bz2
from typing import Any

from bson import BSON, InvalidBSON

from ..util.config import get_redis_conn, get_topic, load_config
from ..util.daemon import Daemon
from ..util.faults import compute_status_from_metrics
from ..util.logger import make_logger, setup_logging
from ..util.managers.nats_manager import nats_manager
from ..util.redis.access import GraphManager

setup_logging()
logger = make_logger("Cloud")
config = load_config()
DATA_TOPIC = get_topic("publish")
nats_manager.set_server(config["nats"]["server"])

try:
    from ..util.faults_ai import get_ai_status

    AI_STATUS_ENABLED = True
except ImportError:
    AI_STATUS_ENABLED = False

    async def get_ai_status(macaddr: str, voltage: float, current: float) -> str:
        del macaddr
        return compute_status_from_metrics(voltage, current)


def _as_float(value: Any) -> float:
    try:
        return float(value or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _normalize_mac(raw: Any) -> str | None:
    if raw is None:
        return None

    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")

    text = str(raw).strip().lower().replace(":", "").replace("-", "")
    if not text:
        return None

    try:
        value = int(text, 16)
    except ValueError:
        return None

    hex_string = f"{value:012x}"[-12:]
    return ":".join(hex_string[i : i + 2] for i in range(0, 12, 2))


class Cloud:
    def __init__(self, redis_conn: Any) -> None:
        self.redis_conn = redis_conn
        self.subscription = None
        self.message_count = 0

    async def start(self) -> None:
        await nats_manager.connect()
        self.subscription = await nats_manager.nats.subscribe(
            DATA_TOPIC,
            cb=self.process_message,
        )
        logger.info(
            "[Cloud] Subscribed to NATS topic %s (AI status: %s)",
            DATA_TOPIC,
            "enabled" if AI_STATUS_ENABLED else "fallback",
        )

    async def stop(self) -> None:
        logger.info("[Cloud] Stopping after %d messages", self.message_count)
        if self.subscription is not None:
            try:
                await self.subscription.unsubscribe()
            except Exception:
                logger.exception("[Cloud] Failed to unsubscribe")
        await nats_manager.disconnect()

    async def process_message(self, msg: Any) -> None:
        self.message_count += 1
        logger.info(
            "[Cloud] Received message #%d on %s (%d bytes)",
            self.message_count,
            getattr(msg, "subject", DATA_TOPIC),
            len(msg.data),
        )

        try:
            decompressed = bz2.decompress(msg.data)
            data = BSON(decompressed).decode()
        except (InvalidBSON, OSError, ValueError) as exc:
            logger.error("[Cloud] Invalid compressed BSON: %s", exc)
            return

        if isinstance(data, dict) and isinstance(data.get("cache"), list):
            records = data["cache"]
            logger.info("[Cloud] Processing batch of %d record(s)", len(records))
        elif isinstance(data, dict):
            records = [data]
        else:
            logger.warning("[Cloud] Dropping unsupported payload type: %s", type(data).__name__)
            return

        for item in records:
            if isinstance(item, bytes):
                try:
                    item = BSON(item).decode()
                except Exception as exc:
                    logger.warning("[Cloud] Skipping cached item: %s", exc)
                    continue
            await self.process_one_record(item)

    async def process_one_record(self, payload: Any) -> None:
        if not isinstance(payload, dict):
            logger.warning("[Cloud] Skipping non-dict record")
            return

        normalized_mac = _normalize_mac(payload.get("macaddr") or payload.get("monitor_mac"))
        if normalized_mac is None:
            logger.warning("[Cloud] Record has no valid MAC address")
            return

        voltage = _as_float(payload.get("Vi"))
        current = _as_float(payload.get("Ii"))
        power = _as_float(payload.get("Pi"))
        temperature = _as_float(payload.get("temperature"))
        status = await get_ai_status(normalized_mac, voltage, current)

        redis_key = f"sitearray:monitor:{normalized_mac}"
        values = {
            "voltage": str(voltage),
            "current": str(current),
            "power": str(power),
            "temperature": str(temperature),
            "status": str(status),
        }

        try:
            self.redis_conn.hset(redis_key, mapping=values)
            logger.info(
                "[Cloud] %s V=%.2f I=%.2f P=%.2f T=%.2f status=%s",
                normalized_mac,
                voltage,
                current,
                power,
                temperature,
                status,
            )
        except Exception:
            logger.exception("[Cloud] Failed to write Redis key %s", redis_key)


class Catcher:
    def __init__(self, site: str = "TEST", db: int = 3) -> None:
        self.site = site
        self.db = db
        self.redis_conn = get_redis_conn(db=self.db)
        self.graph_mgr = GraphManager(client=self.redis_conn)
        self.handler = Cloud(redis_conn=self.redis_conn)

    async def start(self) -> None:
        logger.info("[Catcher] Registering site %r in Redis db %d", self.site, self.db)
        await self.handler.start()

    async def stop(self) -> None:
        await self.handler.stop()


async def run_catcher(site: str = "TEST", db: int = 3) -> None:
    catcher = Catcher(site, db)
    await catcher.start()
    try:
        await asyncio.Event().wait()
    finally:
        await catcher.stop()


class CatcherDaemon(Daemon):
    def run(self) -> None:
        logger.info("[CatcherDaemon] Starting")
        asyncio.run(run_catcher())


if __name__ == "__main__":
    asyncio.run(run_catcher())
