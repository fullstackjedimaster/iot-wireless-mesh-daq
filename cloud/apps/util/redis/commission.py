import json
from cloud.apps.util.redis.access import DeviceNode
from cloud.apps.util.redis.access_utils import clean_json

async def load_node_from_dict(d, client=None, parent=None, verbose=False):
    local_d = d.copy()
    node_id = local_d.pop("id")
    if verbose:
        print(f"📦 Creating node: {node_id}")
    inputs = local_d.pop("inputs", [])
    node = await DeviceNode.create(node_id, client=client, **local_d)
    if parent:
        await node.hook_into(parent)
    for input_d in inputs:
        await load_node_from_dict(input_d, client=client, parent=node, verbose=verbose)

async def restore_to_redis_from_json(json_text: str, client, verbose=False) -> bool:
    try:
        parsed = json.loads(json_text)
        if "sitearray" not in parsed and parsed.get("devtype") == "SA":
            parsed = { "sitearray": parsed }
        clean_data = clean_json(parsed)
        clean_data = decode_keys(clean_data)
        await load_node_from_dict(clean_data["sitearray"], client, verbose=verbose)
        return True
    except Exception as e:
        print(f"❌ Commissioning error: {e}")
        return False

def decode_keys(d):
    if isinstance(d, dict):
        return {k.decode() if isinstance(k, bytes) else k: decode_keys(v) for k, v in d.items()}
    elif isinstance(d, list):
        return [decode_keys(i) for i in d]
    return d
