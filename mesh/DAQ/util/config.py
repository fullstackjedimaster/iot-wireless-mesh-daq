import os
import yaml
import redis
from urllib.parse import urlparse

_config = None


def _default_config_path() -> str:
    # config.yaml located alongside this config.py
    here = os.path.abspath(os.path.dirname(__file__))
    return os.path.join(here, "config.yaml")


def _parse_redis_url(url: str) -> dict:
    u = urlparse(url)
    if u.scheme not in ("redis", "rediss"):
        raise ValueError(f"Unsupported REDIS_URL scheme: {u.scheme}")
    db = 0
    if u.path and u.path != "/":
        try:
            db = int(u.path.lstrip("/"))
        except ValueError:
            db = 0
    return {
        "host": u.hostname or "localhost",
        "port": int(u.port or 6379),
        "db": db,
        # decode_responses handled by redis client creation
    }


def _parse_postgres_url(url: str) -> dict:
    # Supports postgres:// and postgresql://
    u = urlparse(url)
    if u.scheme not in ("postgresql", "postgres"):
        raise ValueError(f"Unsupported DATABASE_URL scheme: {u.scheme}")
    dbname = (u.path or "").lstrip("/") or "postgres"
    return {
        "user": u.username or "postgres",
        "password": u.password or "",
        "host": u.hostname or "localhost",
        "port": int(u.port or 5432),
        "dbname": dbname,
    }


def _apply_env_overrides(config: dict) -> dict:
    """
    Override YAML connectivity from environment.
    This lets the SAME YAML work locally and in Docker.
    """
    # NATS
    nats_url = os.getenv("NATS_URL", "").strip()
    if nats_url:
        config.setdefault("nats", {})
        config["nats"]["server"] = nats_url
        # If mesh has this key, keep it consistent too
        if "external_publish_server" in config["nats"]:
            config["nats"]["external_publish_server"] = nats_url

    external_nats = os.getenv("EXTERNAL_NATS_URL", "").strip()
    if external_nats:
        config.setdefault("nats", {})
        config["nats"]["external_publish_server"] = external_nats

    # Redis
    redis_url = os.getenv("REDIS_URL", "").strip()
    if redis_url:
        config.setdefault("database", {}).setdefault("redis", {})
        r = _parse_redis_url(redis_url)
        config["database"]["redis"].update(r)

    # Postgres
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url:
        config.setdefault("database", {}).setdefault("postgres", {})
        pg = _parse_postgres_url(db_url)
        config["database"]["postgres"].update(pg)

    return config


def load_config():
    """Load YAML config once. Supports env overrides for Docker."""
    global _config
    if _config is not None:
        return _config

    path = os.getenv("SITE_CONFIG", "").strip() or _default_config_path()
    with open(path, "r") as f:
        _config = yaml.safe_load(f) or {}

    _config = _apply_env_overrides(_config)
    return _config


def get_topic(name: str) -> str:
    """Unified NATS topic resolver."""
    config = load_config()
    nats = config.get("nats", {})
    topic_map = {
        "internal_mesh": nats.get("internal_mesh_topic"),
        "external_mesh": nats.get("external_mesh_topic"),
        "publish": nats.get("publish_topic"),
        "command": nats.get("command_topic"),
        "response": nats.get("response_topic"),
        "emulator": nats.get("emulator_topic"),
    }
    return topic_map.get(name) or nats.get(f"{name}_topic")


def get_local_path(global_path, local_path, fname=None):
    """Return path if exists locally, fallback to global."""
    global_path = os.path.normpath(global_path)
    local_path = os.path.normpath(local_path)

    check_path = os.path.join(global_path, fname) if fname else global_path
    return global_path if os.path.exists(check_path) else local_path


def local_config():
    """Return raw loaded YAML without memoization (e.g., for CLI tooling)."""
    path = os.getenv("SITE_CONFIG", "").strip() or _default_config_path()
    if os.path.exists(path):
        with open(path, "r") as f:
            return yaml.safe_load(f) or {}
    return {}


def get_redis_conn(db=3):
    """Returns a Redis connection if Redis is configured."""
    config = load_config()
    redis_conf = config.get("database", {}).get("redis")
    if not redis_conf:
        raise RuntimeError("Redis config not found.")

    use_db = db if db is not None else redis_conf.get("db", 3)
    return redis.StrictRedis(
        host=redis_conf["host"],
        port=int(redis_conf["port"]),
        db=int(use_db),
        decode_responses=True,
    )


def read_pkginfo():
    """Stub for embedded build metadata."""
    return {}
