import glob
import json
from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from typing import Dict, Any, Optional
from .exceptions import GraphNotLoadedException
from .exceptions import MultipleGraphsLoadedException
from app.util.redis.exceptions import RedisException
import json
from typing import Dict, Any, Optional
import redis.asyncio as redis

# Redis slot configuration
MANAGER_SLOT = 0
MIN_SLOT = 1
MAX_SLOT = 158
TESTING_SLOT = 159

# Device type mappings
devtypes = {
    "SA": "Site Array",
    "A": "Site Array",
    "I": "Inverter",
    "B": "Bus",
    "R": "Recombiner",
    "C": "Combiner",
    "S": "String",
    "P": "Panel",
    "SLE": "SPT String Level Equalizer",
    "SPM": "SPT Panel Monitor",
    "SPO": "SPT Panel Monitor",
    "PLM": "SPT Panel Monitor",  # old
    "PLO": "SPT Panel Monitor",  # old
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


def graphkey_current_label(gk):
    """
    Returns the label portion of the current nodes graphkey

    Excludes the devtype.
    """
    if '.' in gk:
        return gk.split('.')[-1].split(':')[-1]
    else:
        return gk.split(':')[-1]

def graphkey_device_hierarchy_label(gk, exclude_devtypes=set(['SA', 'A', 'B'])):
    if '.' in gk:
        devtype = graphkey_devtype(gk)
        label = graphkey_current_label(gk)
        parents = all_graphkey_parents(gk)

        text = "%s %s" % (devtypes[devtype], label)

        for parent in parents:
            pdevtype = graphkey_devtype(parent)
            plabel = graphkey_current_label(parent)

            if exclude_devtypes \
            and pdevtype in exclude_devtypes:
                continue

            text += " in %s %s" % (devtypes[pdevtype], plabel)

        return text
    else:
        return gk


monitor_devtypes = [ "SPM", "SPO", "PLM", "PLO", "SLE" ]


def get_human_readable( node_id, client=None ):
    """
    Return the appropriate label for the node.
    """
    try:
        devtype, num = node_id.split("-")
    except:
        return None
    if devtype == "P":
        return get_prop( node_id, "ulabel", client=client )
    return get_prop( node_id, "label", client=client )

# Utility Functions
def get_redis_client(db: int = MANAGER_SLOT) -> redis.Redis:
    """Returns a Redis client."""
    return redis.Redis(host="localhost", port=6379, db=db, decode_responses=True)


def get_dev_abbrev(node_id: str) -> str:
    """Return the acronym from the node ID."""
    dev_abbrev, _ = node_id.split("-")
    return dev_abbrev


def get_devtype(node_id: str) -> str:
    """Return the device type for a given node."""
    return devtypes[get_dev_abbrev(node_id)]


def get_prop(device_id: str, propname: str, client: redis.Redis) -> Optional[str]:
    """Get a specific property of a device node."""
    try:
        return client.hget(device_id, propname)
    except RedisException:
        return None

def get_props(device_id: str, client: redis.Redis) -> Dict[str, str]:
    """Get all properties of a device node."""
    try:
        return client.hgetall(device_id)
    except RedisException:
        return {}


def set_props(device_id: str, prop_dict: Dict[str, Any], client: redis.Redis) -> None:
    """Set multiple properties for a device node."""
    try:
        client.hmset(device_id, prop_dict)
    except RedisException as e:
        raise Exception(f"Error setting properties: {str(e)}")

def _get_an_id( prefix, client=None ):
    """
    Return an id constructed from the Sitearray ID.
    """
    if client != None and client.db != MANAGER_SLOT:
        sitearray_id = get_sitearray_id( client=client )
        return sitearray_id.replace( "SA-", prefix )
    return None


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


def get_named_props( device_id, propname_array, client=None ):
    """
    get particular properties for a DeviceNode
    """
    result = []
    if client != None:
        cldict = client.Dict(device_id)
        for propname in propname_array:
            result.append( cldict[propname] )
    return result


def get_sitearray_id( client=None ):
    """
    Return the sitearray id for the redis slot
    managed by the provided client. Do some
    sanity checking along the way.
    """
    if client is not None and MANAGER_SLOT != client.db:
        sa_ids = client.keys(pattern="SA-*")
        if len(sa_ids) < 1:
            raise GraphNotLoadedException( client.db )
        elif len(sa_ids) > 1:
            raise MultipleGraphsLoadedException( client.db )
        sa_id = str(sa_ids[0])
        return sa_id
    return None

def get_zone_id( client=None ):
    """
    Return the zone id that corresponds with this sitearray.
    """
    return _get_an_id( "Z-", client=client )

def get_devdict_id( client=None ):
    """
    Return the devdict id that corresponds with this sitearray.
    """
    return _get_an_id( "DEV-", client=client )

def get_histdict_id( client=None ):
    """
    Return the histdict id that corresponds with this sitearray.
    """
    return _get_an_id( "HIST-", client=client )

def get_busnrule_id( client=None ):
    """
    Return the busnrule id that corresponds with this sitearray.
    """
    return _get_an_id( "BUSN-", client=client )
def select_node( nodes, propname, value, client=None ):
    """
    Return the first node from the list of nodes that
    has a property named 'propname' that matches the value.
    If 'value' is None, return the first node with that property.
    """
    for node in nodes:
        props = get_props( node, client=client )
        if propname in props:
            if value == None or props[propname] == value:
                return node
    return None


def find_sitearray_files(
    sitename: str = "", basedir: str = "../../test-data/redisSiteArrays"
) -> List[str]:
    """Find JSON files for site arrays based on sitename."""
    matchspec = f"{basedir}/{sitename}*.json"
    return glob.glob(matchspec)


def find_sitearray_file(
    sitename: str, basedir: str = "../../test-data/redisSiteArrays"
) -> str:
    """Find a single JSON file for a specific sitename."""
    files = find_sitearray_files(sitename, basedir)
    if len(files) > 1:
        raise Exception(f"More than one JSON file found for sitename {sitename}")
    elif len(files) == 0:
        raise Exception(f"No JSON file found for sitename {sitename}")
    return files[0]


async def load_node_from_dict(data: Dict[str, Any], client: redis.Redis, parent: Optional[str] = None) -> None:
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

async def restore_to_redis_from_json(graph_json: str, client: redis.Redis):
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

        if node.get("devtype") == "SPM":  # monitor node
            mac = node.get("macaddr", "").lower()
            if mac:
                redis_key = f"sitearray:monitor:{mac}"

                def safe_int(val):
                    return int(val) if isinstance(val, (int, float)) else 0

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

    # Store real-time monitor nodes
    await walk(root)

    # Store logical device structure
    await load_node_from_dict(root, client)


# GraphKey Utilities
def graphkey_token_devtype(token: str) -> str:
    """Returns the device type of a graph key token."""
    return token.split(":")[0]


def graphkey_devtype(gk: str) -> str:
    """Returns the device type of a given graph key."""
    tokens = gk.split(".")
    return graphkey_token_devtype(tokens[-1])


def graphkey_parent(gk: str, devtype: Optional[str] = None) -> str:
    """Return the parent graph key of a given graph key."""
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
    """Return a list of all parent graph keys."""
    parent_gkeys = []
    current_gk = gk
    while "." in current_gk:
        current_gk = graphkey_parent(current_gk)
        parent_gkeys.append(current_gk)
    return parent_gkeys


