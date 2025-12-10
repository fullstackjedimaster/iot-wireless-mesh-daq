import os
import yaml
import redis
import psycopg2
from psycopg2.extras import DictCursor

DEFAULT_APP_CONFIG = "/opt/projects/iot-wireless-mesh-daq/cloud/app/util/config.yaml"

_config = None


def load_config():
    """Load YAML config once. Automatically detects site vs. app context."""
    global _config
    if _config is not None:
        return _config

    path = DEFAULT_APP_CONFIG

    with open(path, "r") as f:
        _config = yaml.safe_load(f)
    return _config


def get_topic(name: str) -> str:
    """Unified NATS topic resolver."""
    config = load_config()
    topic_map = {
        "internal_mesh": config["nats"].get("internal_mesh_topic"),
        "external_mesh": config["nats"].get("external_mesh_topic"),
        "publish": config["nats"].get("publish_topic"),
        "command": config["nats"].get("command_topic"),
        "response": config["nats"].get("response_topic"),
        "emulator": config["nats"].get("emulator_topic"),
    }
    return topic_map.get(name) or config["nats"].get(f"{name}_topic")


def get_redis_conn(db=3):
    """Returns a Redis connection if Redis is configured."""
    config = load_config()
    redis_conf = config.get("database", {}).get("redis")
    if not redis_conf:
        raise RuntimeError("Redis config not found.")
    return redis.StrictRedis(
        host=redis_conf["host"],
        port=redis_conf["port"],
        db=db if db is not None else redis_conf.get("db", 3),
        decode_responses=True
    )


def get_postgres_conn():
    """Returns a PostgreSQL connection if configured."""
    config = load_config()
    pg = config.get("database", {}).get("postgres")
    if not pg:
        raise RuntimeError("Postgres config not found.")
    return psycopg2.connect(
        dbname=pg["dbname"],
        user=pg["user"],
        password=pg["password"],
        host=pg["host"],
        port=pg["port"],
        cursor_factory=DictCursor
    )


def get_templates_dir():
    """Returns the Jinja2 templates directory (for cloud)."""
    config = load_config()
    return config.get("paths", {}).get("templates_dir", "app/templates")


def get_local_path(global_path, local_path, fname=None):
    """Return path if exists locally, fallback to global."""
    global_path = os.path.normpath(global_path)
    local_path = os.path.normpath(local_path)

    if fname:
        check_path = os.path.join(global_path, fname)
    else:
        check_path = global_path

    return global_path if os.path.exists(check_path) else local_path


def local_config():
    """Return raw loaded YAML without memoization (e.g., for CLI tooling)."""

    if os.path.exists(DEFAULT_APP_CONFIG):
        with open(DEFAULT_APP_CONFIG, "r") as f:
            return yaml.safe_load(f)
    return {}


def read_pkginfo():
    """Stub for embedded build metadata."""
    return {}
