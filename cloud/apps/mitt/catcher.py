#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import bz2
from typing import Any, Awaitable, Callable

from bson import BSON, InvalidBSON

from ..util.config import get_redis_conn, get_topic, load_config
from ..util.daemon import Daemon
from ..util.faults import assess_metrics
from ..util.logger import make_logger, setup_logging
from ..util.managers.nats_manager import nats_manager
from ..util.redis.access import GraphManager

setup_logging()
logger = make_logger("Cloud")
config = load_config()
DATA_TOPIC = get_topic("publish")
nats_manager.set_server(config["nats"]["server"])

try:
    from ..util.faults_ai import get_ai_status as _external_ai_status
except ImportError:
    _external_ai_status = None


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
    return ":".join(hex_string[i:i + 2] for i in range(0, 12, 2))


async def _resolve_status(mac: str, voltage: float, current: float, power: float, temperature: float, irradiance: float) -> str:
    if _external_ai_status is not None:
        try:
            return str(await _external_ai_status(
                macaddr=mac, voltage=voltage, current=current, power=power,
                temperature=temperature, irradiance=irradiance,
            ))
        except TypeError:
            logger.warning("faults_ai uses the legacy signature; falling back to deterministic solar classifier")
        except Exception:
            logger.exception("faults_ai failed; falling back to deterministic solar classifier")
    return assess_metrics(voltage, current, power, temperature, irradiance).status


class Cloud:
    def __init__(self, redis_conn: Any) -> None:
        self.redis_conn = redis_conn
        self.subscription = None
        self.message_count = 0

    async def start(self) -> None:
        await nats_manager.connect()
        self.subscription = await nats_manager.nats.subscribe(DATA_TOPIC, cb=self.process_message)
        logger.info("[Cloud] Subscribed to NATS topic %s", DATA_TOPIC)

    async def stop(self) -> None:
        if self.subscription is not None:
            try:
                await self.subscription.unsubscribe()
            except Exception:
                logger.exception("[Cloud] Failed to unsubscribe")
        await nats_manager.disconnect()

    async def process_message(self, msg: Any) -> None:
        self.message_count += 1
        try:
            data = BSON(bz2.decompress(msg.data)).decode()
        except (InvalidBSON, OSError, ValueError) as exc:
            logger.error("[Cloud] Invalid compressed BSON: %s", exc)
            return
        records = data.get("cache", []) if isinstance(data, dict) and isinstance(data.get("cache"), list) else [data]
        for item in records:
            if isinstance(item, bytes):
                try:
                    item = BSON(item).decode()
                except Exception:
                    logger.exception("[Cloud] Failed to decode cached item")
                    continue
            await self.process_one_record(item)

    async def process_one_record(self, payload: Any) -> None:
        if not isinstance(payload, dict):
            return
        mac = _normalize_mac(payload.get("macaddr") or payload.get("monitor_mac"))
        if mac is None:
            logger.warning("[Cloud] Record has no valid MAC address")
            return
        voltage = _as_float(payload.get("Vi"))
        current = _as_float(payload.get("Ii"))
        power = _as_float(payload.get("Pi"))
        temperature = _as_float(payload.get("temperature"))
        irradiance = _as_float(payload.get("irradiance"))
        assessment = assess_metrics(voltage, current, power, temperature, irradiance)
        status = await _resolve_status(mac, voltage, current, power, temperature, irradiance)
        values = {
            "voltage": str(voltage), "current": str(current), "power": str(power),
            "temperature": str(temperature), "irradiance": str(irradiance),
            "expected_power": str(assessment.expected_power),
            "performance_ratio": str(assessment.performance_ratio),
            "environmental_state": assessment.environmental_state,
            "diagnostic_basis": assessment.diagnostic_basis,
            "status": status,
        }
        key = f"sitearray:monitor:{mac}"
        self.redis_conn.hset(key, mapping=values)
        logger.info("%s V=%.2f I=%.2f P=%.2f T=%.2f G=%.1f expected=%.2f ratio=%.3f %s", mac, voltage, current, power, temperature, irradiance, assessment.expected_power, assessment.performance_ratio, status)


class Catcher:
    def __init__(self, site: str = "TEST", db: int = 3) -> None:
        self.redis_conn = get_redis_conn(db=db)
        self.graph_mgr = GraphManager(client=self.redis_conn)
        self.handler = Cloud(redis_conn=self.redis_conn)
    async def start(self) -> None: await self.handler.start()
    async def stop(self) -> None: await self.handler.stop()


async def run_catcher(site: str = "TEST", db: int = 3) -> None:
    catcher = Catcher(site, db)
    await catcher.start()
    try: await asyncio.Event().wait()
    finally: await catcher.stop()


class CatcherDaemon(Daemon):
    def run(self) -> None: asyncio.run(run_catcher())


if __name__ == "__main__":
    asyncio.run(run_catcher())
