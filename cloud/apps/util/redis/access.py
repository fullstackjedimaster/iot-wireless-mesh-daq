from typing import Optional, List, Dict, Any
from .access_utils import (
    get_sitearray_id,
    get_named_props,
    get_prop,
    get_dev_abbrev,
    dict_from_nodes,
    monitor_devtypes,
    get_redis_client,
)
from .exceptions import BadIdForDeviceNodeException
from redis.asyncio import Redis


class GraphNode:
    def __init__(self, id: str, client: Redis):
        self.id = id
        self.rdb = client
        self.props = {}

    async def hook_into(self, parent):
        if await self.rdb.hexists(self.id, "parent"):
            existing = await self.rdb.hget(self.id, "parent")
            if existing.decode() != parent.id:
                await self.rdb.hset(self.id, "parent2", parent.id)
        else:
            await self.rdb.hset(self.id, "parent", parent.id)

        in_key = f"in:{parent.id}"
        existing_inputs = await self.rdb.lrange(in_key, 0, -1)
        if self.id.encode() not in existing_inputs:
            await self.rdb.rpush(in_key, self.id)


class DeviceNode(GraphNode):
    def __init__(self, id: str, client: Redis):
        super().__init__(id, client)

    @classmethod
    async def create(cls, id: str, client: Redis, **kwargs):
        self = cls(id, client)
        if kwargs:
            await client.hset(id, mapping=kwargs)
        raw = await client.hgetall(id)
        self.props = {k.decode(): v.decode() for k, v in raw.items()}
        return self

    async def matching_inputs(self, match: List[str]) -> List[str]:
        keys = await self.rdb.keys("in:*")
        visited = []

        async def _walk(node_id):
            visited.append(node_id)
            in_key = f"in:{node_id}"
            if await self.rdb.exists(in_key):
                children = await self.rdb.lrange(in_key, 0, -1)
                for child in children:
                    await _walk(child.decode())

        await _walk(self.id)
        return [
            node_id for node_id in visited
            if "-" in node_id and (not match or node_id.split("-")[0] in match)
        ]


class GraphManager:
    def __init__(self, client: Redis):
        self.client = client

    async def current_sitearray_id(self) -> str:
        return await get_sitearray_id(self.client)

    async def current_sitearray(self) -> DeviceNode:
        node_id = await self.current_sitearray_id()
        return DeviceNode(node_id, self.client)

    async def monitor_mac_to_panel_map(self) -> Dict[str, str]:
        result = {}
        sa_node = await self.current_sitearray()
        panels = await sa_node.matching_inputs(["P"])
        for panel_id in panels:
            in_key = f"in:{panel_id}"
            if await self.client.exists(in_key):
                children = await self.client.lrange(in_key, 0, -1)
                for child in children:
                    child_id = child.decode()
                    if child_id.startswith("M-"):
                        mac = await self.client.hget(child_id, "macaddr")
                        if mac:
                            result[mac.decode()] = panel_id
        return result

    async def macaddr_panel_ulabels(self) -> Dict[str, str]:
        result = {}
        sa_node = await self.current_sitearray()
        panels = await sa_node.matching_inputs(["P"])
        for panel_id in panels:
            in_key = f"in:{panel_id}"
            if await self.client.exists(in_key):
                children = await self.client.lrange(in_key, 0, -1)
                for child in children:
                    child_id = child.decode()
                    if child_id.startswith("M-"):
                        mac = await self.client.hget(child_id, "macaddr")
                        ulabel = await self.client.hget(panel_id, "ulabel")
                        if mac and ulabel:
                            result[mac.decode()] = ulabel.decode()
        return result

    async def macaddr_panel_labels(self) -> Dict[str, str]:
        result = await self.macaddr_panel_ulabels()
        return {k: v.split("|")[1] for k, v in result.items() if "|" in v}

    async def current_sitearray_as_dict(self, ignore_monitors=True, include_devtype=False) -> Dict[str, Any]:
        sa = await self.current_sitearray()
        nodes = await sa.matching_inputs([])  # all inputs
        if ignore_monitors:
            nodes = [n for n in nodes if get_dev_abbrev(n) not in monitor_devtypes]
        return await dict_from_nodes(nodes, self.client, include_devtype)

    async def node_from_graph_key(self, graph_key: str) -> Optional[DeviceNode]:
        key = f"gkey:{graph_key}"
        if await self.client.exists(key):
            node_id = await self.client.get(key)
            return DeviceNode(node_id.decode(), self.client)
        return None

    async def print_devices(self):
        devices = await self.current_sitearray_as_dict(ignore_monitors=True)
        import pprint
        pprint.pprint(devices)
