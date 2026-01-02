# /cloud/apps/bootstrap_sitearray_redis.py

import asyncio
import redis.asyncio as redis
from util.redis.access_utils import get_redis_client
from sitedata.access_utils import restore_to_redis_from_json

async def bootstrap_sitearray_redis(sitename, json_path, redis_db=3):
    with open(json_path, 'r') as f:
        graph_json = f.read()

    client = await get_redis_client(db=redis_db)
    await client.flushdb()
    await restore_to_redis_from_json(graph_json, client)

    print(f"✅ Site array '{sitename}' loaded into Redis DB {redis_db}")

if __name__ == "__main__":
    asyncio.run(bootstrap_sitearray_redis("TEST", "site_graph_TEST.json"))
