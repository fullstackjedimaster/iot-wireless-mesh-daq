import glob
import json
from typing import Any, Dict, List, Optional
from redis.asyncio import Redis
from .exceptions import GraphNotLoadedException, MultipleGraphsLoadedException

# ---------------------------------------------------------------------------
# Redis slot configuration
# ---------------------------------------------------------------------------
MANAGER_SLOT = 0
MIN_SLOT = 1
MAX_SLOT = 158
TESTING_SLOT = 159

# ---------------------------------------------------------------------------
# Device type mappings
# ---------------------------------------------------------------------------
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
    "PLM": "SPT Panel Monitor",  # legacy
    "PLO": "SPT Panel Monitor",  # legacy
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

monitor_devtypes = ["SPM", "SPO", "PLM", "PLO", "SLE"]

devtype_names = {
    "sitearray": "SA",
    "inverter": "I",
    "recombiner": "R",
    "combiner": "C",
    "string": "S",
    "panel": "P",
    "equalizer": "SLE",
    "monitor": "SPM",  # default
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

# ---------------------------------------------------------------------------
# Redis client
# ---------------------------------------------------------------------------

async def get_redis_client(db: int = MANAGER_SLOT) -> Redis:
    """Return a Redis client (async)."""
    return Redis(host="localhost", port=6379, db=db, decode_responses=True)

# ---------------------------------------------------------------------------
# GraphKey utilities
# ---------------------------------------------------------------------------

def graphkey_token_devtype(token: str) -> str:
    return token.split(":")[0]

def graphkey_devtype(gk: str) -> str:
    tokens = gk.split(".")
    return graphkey_token_devtype(tokens[-1])

def graphkey_current_label(gk: str) -> str:
    """Returns label portion of current graphkey (excludes devtype)."""
    if "." in gk:
        return gk.split(".")[-1].split(":")[-1]
    return gk.split(":")[-1]

def graphkey_parent(gk: str, devtype: Optional[str] = None) -> str:
    """Return parent graphkey of given graphkey."""
    if "." in gk:
        tokens = gk.split(".")
        if devtype is None:
            tokens = tokens[:-1]
        else:
            devtypes_list = [graphkey_token_devtype(x) for x in tokens]
            i = devtypes_list.index(devtype)
            tokens = tokens[: i + 1]
        return ".".join(tokens)
    return gk

def all_graphkey_parents(gk: str) -> List[str]:
    """Return list of all parent graphkeys."""
    parent_gkeys = []
    current_gk = gk
    while "." in current_gk:
        current_gk = graphkey_parent(current_gk)
        parent_gkeys.append(current_gk)
    return parent_gkeys

def graphkey_device_hierarchy_label(gk: str, exclude_devtypes=set(["SA", "A", "B"])) -> str:
    if "." not in gk:
        return gk
    devtype = graphkey_devtype(gk)
    label = graphkey_current_label(gk)
    parents = all_graphkey_parents(gk)
    text = f"{devtypes.get(devtype, devtype)} {label}"
    for parent in parents:
        pdevtype = graphkey_devtype(parent)
        plabel = graphkey_current_label(parent)
        if exclude_devtypes and pdevtype in exclude_devtypes:
            continue
        text += f" in {devtypes.get(pdevtype, pdevtype)} {plabel}"
    return text

# ---------------------------------------------------------------------------
# Device label/phrase helpers
# ---------------------------------------------------------------------------

def panel_phrase(ulabel: str, use_lower: bool = False) -> str:
    s, p = ulabel.split("|")
    return f"{'panel' if use_lower else 'Panel'} {p} in {'string' if use_lower else 'String'} {s}"

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

# ---------------------------------------------------------------------------
# Async Redis property accessors
# ---------------------------------------------------------------------------

async def get_props(device_id: str, client: Redis, include_devtype: bool = False) -> Dict[str, str]:
    data = await client.hgetall(device_id)
    props = dict(data)
    if include_devtype and "id" in props:
        props["devtype"] = get_devtype(props["id"])
    return props

async def set_props(device_id: str, propdict: Dict[str, Any], client: Redis):
    await client.hset(device_id, mapping=propdict)

async def get_prop(device_id: str, propname: str, client: Redis) -> Optional[str]:
    return await client.hget(device_id, propname)

async def set_prop(device_id: str, propname: str, value: str, client: Redis):
    await client.hset(device_id, propname, value)

async def get_named_props(device_id: str, propname_array: List[str], client: Redis) -> List[Optional[str]]:
    results = []
    for prop in propname_array:
        val = await client.hget(device_id, prop)
        results.append(val)
    return results

async def select_node(nodes: List[str], propname: str, value: Optional[str], client: Redis):
    for node in nodes:
        props = await get_props(node, client)
        if propname in props and (value is None or props[propname] == value):
            return node
    return None

# ---------------------------------------------------------------------------
# Sitearray ID helpers
# ---------------------------------------------------------------------------

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
    return keys[0]

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

# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------

def clean_json(data):
    if isinstance(data, dict):
        return {clean_json(k): clean_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_json(item) for item in data]
    elif isinstance(data, bytes):
        return data.decode()
    return data

# ---------------------------------------------------------------------------
# Redis graph loaders
# ---------------------------------------------------------------------------

def dict_from_nodes( nodes, client=None, include_devtype=False ):
    """
    Recursively collect nodes into one dictionary.
    """
    result = {}
    dict_stack = []
    dict_stack.append( result )
    for node in nodes:
        if node == "{":
            dict_stack.append( {} )
        elif node == "}":
            if len(dict_stack[-1]) < 1:
                del dict_stack[-1]

            if len(dict_stack) > 1:
                d = dict_stack[-1]
                if "inputs" not in dict_stack[-2]:
                    dict_stack[-2]["inputs"] = [d.copy()]
                else:
                    dict_stack[-2]["inputs"].append( d.copy() )
                dict_stack[-1].clear()
        else:
            d = dict_stack[-1]
            d.update(get_props(node, client=client))
    return result

async def load_node_from_dict(data: Dict[str, Any], client: Redis, parent: Optional[str] = None) -> None:
    """Recursively load a node and its inputs into Redis (async)."""
    node_id = data["id"]
    node_data = {k: v for k, v in data.items() if k not in ("id", "inputs")}
    inputs = data.get("inputs", [])

    await client.hset(node_id, mapping=node_data)

    if parent:
        await client.rpush(f"in:{parent}", node_id)
        await client.hset(node_id, "parent", parent)

    for child in inputs:
        await load_node_from_dict(child, client, parent=node_id)

async def restore_to_redis_from_json(graph_json: str, client: Redis):
    """
    Restore monitor nodes and logical hierarchy from site graph JSON into Redis.
    - Stores monitor nodes under 'sitearray:monitor:{macaddr}'
    - Loads full device tree using load_node_from_dict()
    """
    graph = json.loads(graph_json)
    root = graph.get("sitearray")

    if not root:
        raise ValueError("Invalid site graph: missing 'sitearray' root node")

    async def walk(node):
        if not isinstance(node, dict):
            return
        if node.get("devtype") == "SPM":
            mac = node.get("macaddr", "").lower()
            if mac:
                redis_key = f"sitearray:monitor:{mac}"
                def safe_int(val): return int(val) if isinstance(val, (int, float)) else 0
                data = {
                    "x": safe_int(node.get("x")),
                    "y": safe_int(node.get("y")),
                    "status": "grey",
                    "voltage": 0,
                    "current": 0,
                    "power": 0,
                    "temperature": 0,
                }
                await client.hset(redis_key, mapping=data)
        for child in node.get("inputs", []):
            await walk(child)

    await walk(root)              # store real-time monitor nodes
    await load_node_from_dict(root, client)  # store logical device structure
