import glob
from redis.asyncio import Redis
from .exceptions import *
from typing import Optional, List, Dict

MANAGER_SLOT = 0
MIN_SLOT = 1
MAX_SLOT = 158
TESTING_SLOT = 159

devtypes = {
    "SA": "Site Array",
    "I": "Inverter",
    "R": "Recombiner",
    "C": "Combiner",
    "S": "String",
    "P": "Panel",
    "SLE": "SPT String Level Equalizer",
    "SPM": "SPT Panel Monitor",
    "SPO": "SPT Panel Monitor",
    "S1W": "String 1 Wire",
    "ACM": "AC Meter",
    "SGW": "SPT Gateway",
    "SSS": "SPT Site Server",
    "SSC": "Site Server Computer",
    "ESI": "Env Sensor Interface",
    "ABT": "Ambient Temperature Sensor",
    "CET": "Cell Temperature Sensor",
    "IRR": "Irradiance Sensor",
}

monitor_devtypes = ["SPM", "SPO", "SLE"]

devtype_names = {
    "sitearray": "SA",
    "inverter": "I",
    "recombiner": "R",
    "combiner": "C",
    "string": "S",
    "panel": "P",
    "equalizer": "SLE",
    "monitor": "SPM",
    "monitor": "SPO",
    "one wire": "S1W",
    "AC meter": "ACM",
    "gateway": "SGW",
    "site server": "SSS",
    "site server computer": "SSC",
    "env sensor interface": "ESI",
    "ambient temp": "ABT",
    "cell temp": "CET",
    "irradiance": "IRR",
}

def panel_phrase(ulabel: str, use_lower: bool = False) -> str:
    s, p = ulabel.split("|")
    if use_lower:
        return f"panel {p} in string {s}"
    return f"Panel {p} in String {s}"

def phrase(label: str, use_lower: bool = False) -> str:
    code, num = label.split(":")
    devtype = devtypes.get(code, "Unknown")
    if use_lower:
        devtype = devtype.lower()
    return f"{devtype} {num}"

def get_dev_abbrev(node_id: str) -> str:
    return node_id.split("-")[0]

def get_devtype(node_id: str) -> str:
    return devtypes.get(get_dev_abbrev(node_id), "Unknown")

async def get_redis_client(db=0) -> Redis:
    return Redis(host="localhost", port=6379, db=db)

async def has_sitearray_id(client: Redis) -> bool:
    keys = await client.keys("SA-*")
    if len(keys) == 1:
        return True
    elif len(keys) > 1:
        raise MultipleGraphsLoadedException(client.db)
    return False

async def get_sitearray_id(client: Redis) -> str:
    keys = await client.keys("SA-*")
    if not keys:
        raise GraphNotLoadedException(client.db)
    if len(keys) > 1:
        raise MultipleGraphsLoadedException(client.db)
    return keys[0].decode()

async def _get_an_id(prefix: str, client: Redis) -> str:
    sa_id = await get_sitearray_id(client)
    return sa_id.replace("SA-", prefix)

async def get_zone_id(client: Redis) -> str:
    return await _get_an_id("Z-", client)

async def get_devdict_id(client: Redis) -> str:
    return await _get_an_id("DEV-", client)

async def get_histdict_id(client: Redis) -> str:
    return await _get_an_id("HIST-", client)

async def get_busnrule_id(client: Redis) -> str:
    return await _get_an_id("BUSN-", client)

async def get_portfolio_data_id(client: Redis) -> str:
    return await _get_an_id("PORT-", client)

async def get_props(device_id: str, client: Redis, include_devtype: bool = False) -> dict:
    data = await client.hgetall(device_id)
    props = {k.decode(): v.decode() for k, v in data.items()}
    if include_devtype and "id" in props:
        props["devtype"] = get_devtype(props["id"])
    return props

async def set_props(device_id: str, propdict: dict, client: Redis):
    await client.hset(device_id, mapping=propdict)

async def get_prop(device_id: str, propname: str, client: Redis):
    val = await client.hget(device_id, propname)
    return val.decode() if val else None

async def set_prop(device_id: str, propname: str, value: str, client: Redis):
    await client.hset(device_id, propname, value)

async def get_named_props(device_id: str, propname_array: list, client: Redis) -> list:
    results = []
    for prop in propname_array:
        val = await client.hget(device_id, prop)
        results.append(val.decode() if val else None)
    return results

async def select_node(nodes: list, propname: str, value: Optional[str], client: Redis):
    for node in nodes:
        props = await get_props(node, client)
        if propname in props and (value is None or props[propname] == value):
            return node
    return None

def clean_json(data):
    if isinstance(data, dict):
        return {clean_json(k): clean_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_json(item) for item in data]
    elif isinstance(data, str):
        return data  # No encoding needed
    elif isinstance(data, bytes):
        return data.decode()  # Optional: decode bytes to str
    else:
        return data

async def dict_from_nodes(nodes: list, client: Redis, include_devtype=False) -> dict:
    result = {}
    stack = [result]
    for node in nodes:
        if node == "{":
            stack.append({})
        elif node == "}":
            last = stack.pop()
            if stack:
                stack[-1].setdefault("inputs", []).append(last.copy())
        else:
            props = await get_props(node, client, include_devtype)
            stack[-1].update(props)
    return result
