import asyncio
from redis.asyncio import Redis
from cloud.apps.util.redis.access import DeviceNode
from cloud.apps.util.redis.access_utils import get_sitearray_id

async def print_node_tree(client: Redis, node_id: str, level: int = 0):
    indent = "  " * level
    props = await client.hgetall(node_id)
    label = props.get(b"label", b"(no label)").decode()
    devtype = props.get(b"devtype", b"(no devtype)").decode()
    macaddr = props.get(b"macaddr", b"").decode()

    print(f"{indent}- [{devtype}] {label} ({node_id}) {'[MAC: ' + macaddr + ']' if macaddr else ''}")

    in_key = f"in:{node_id}"
    if await client.exists(in_key):
        children = await client.lrange(in_key, 0, -1)
        for child_id in children:
            await print_node_tree(client, child_id.decode(), level + 1)

async def main():
    client = Redis(db=1)
    try:
        sa_id = await get_sitearray_id(client)
        print(f"\n📦 SiteArray root ID: {sa_id}\n")
        await print_node_tree(client, sa_id)
    except Exception as e:
        print(f"❌ Failed to print site graph: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(main())
