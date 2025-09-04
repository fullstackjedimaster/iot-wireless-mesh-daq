import os
import yaml
import redis

DEFAULT_SITE_CONFIG = "/opt/projects/mesh/DAQ/util/config.yaml"

_config = None


def load_config():
    """Load YAML config once. Automatically detects site vs. app context."""
    global _config
    if _config is not None:
        return _config


    path = DEFAULT_SITE_CONFIG

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
    if os.path.exists(DEFAULT_SITE_CONFIG):
        with open(DEFAULT_SITE_CONFIG, "r") as f:
            return yaml.safe_load(f)
    return {}

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



def read_pkginfo():
    """Stub for embedded build metadata."""
    return {}
