# /cloud/apps/commissioning/commission_and_bootstrap.py
import os
import json
import psycopg2
import asyncio
from ..util.redis.access_utils import get_redis_client, restore_to_redis_from_json

SITE_NAME = "TEST"
GRAPH_FILENAME = "site_graph_TEST.json"

def load_site_graph():
    path = os.path.join(os.path.dirname(__file__), GRAPH_FILENAME)
    with open(path, "r") as f:
        return json.load(f)

def validate_graph(graph):
    """Verify all devtype P (panels) have x/y coords."""
    missing = []

    def walk(node):
        if not isinstance(node, dict):
            return
        if node.get("devtype") == "P":
            if "x" not in node or "y" not in node:
                missing.append(node.get("macaddr"))
        for child in node.get("inputs", []):
            walk(child)

    sitearray = graph.get("sitearray")
    if sitearray:
        walk(sitearray)

    if missing:
        raise Exception(f"❌ Missing x/y layout for MACs: {missing}")

def insert_sitegraph(graph):
    """Replace site_graph in Postgres with provided graph JSON."""
    site_graph_json = json.dumps(graph)

    conn = psycopg2.connect(
        dbname="ss", user="ss", password="Y@$$p4644313?", host="localhost", port=5432
    )
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id FROM ss.site WHERE sitename = %s", (SITE_NAME,))
    site_row = cur.fetchone()
    if not site_row:
        raise Exception("Site not found")
    site_id = site_row[0]

    cur.execute("SELECT id FROM ss.site_array WHERE site_id = %s", (site_id,))
    sa_row = cur.fetchone()
    if not sa_row:
        raise Exception("Site array not found")
    sa_id = sa_row[0]

    # Delete existing
    cur.execute("DELETE FROM ss.site_graph WHERE sitearray_id = %s", (sa_id,))
    # Insert new
    cur.execute(
        "INSERT INTO ss.site_graph (sitearray_id, json) VALUES (%s, %s)",
        (sa_id, site_graph_json),
    )
    cur.close()
    conn.close()
    print("✅ Site graph commissioned into Postgres.")
    return sa_id

def fetch_sitegraph(sa_id):
    """Fetch back JSON from Postgres."""
    conn = psycopg2.connect(
        dbname="ss", user="ss", password="Y@$$p4644313?", host="localhost", port=5432
    )
    cur = conn.cursor()
    cur.execute("SELECT json FROM ss.site_graph WHERE sitearray_id = %s", (sa_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise Exception("❌ site_graph not found in Postgres")
    return json.loads(row[0])

async def load_into_redis(graph):
    client = await get_redis_client(db=3)
    await client.flushdb()
    await restore_to_redis_from_json(json.dumps(graph), client)
    print(f"✅ Site array '{SITE_NAME}' loaded into Redis DB 3 with hierarchy + monitor nodes")

def main():
    # Step 1: Load file
    graph = load_site_graph()

    # Step 2: Validate
    validate_graph(graph)

    # Step 3: Insert into Postgres
    sa_id = insert_sitegraph(graph)

    # Step 4: Fetch back
    graph_json = fetch_sitegraph(sa_id)

    # Step 5: Validate again (sanity check)
    validate_graph(graph_json)

    # Step 6: Push into Redis
    asyncio.run(load_into_redis(graph_json))

if __name__ == "__main__":
    main()
