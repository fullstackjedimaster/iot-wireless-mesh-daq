import psycopg2
import json
import os
from uuid import uuid4

SITE_NAME = "TEST"
GRAPH_FILENAME = "site_graph_TEST.json"

# Load JSON from local file
def load_site_graph():
    path = os.path.join(os.path.dirname(__file__), GRAPH_FILENAME)
    with open(path, "r") as f:
        data = json.load(f)
    return data

# Verify all devtype "P" nodes have x/y coords
def validate_graph(graph):
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
        raise Exception(f"Missing x/y layout for MACs: {missing}")

# Insert graph into Postgres
def insert_sitegraph(graph):
    site_graph_json = json.dumps(graph)

    conn = psycopg2.connect(
        dbname="ss", user="ss_user", password="LeartPee1138?", host="localhost", port=5432
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

    # Delete existing row if one exists
    cur.execute("DELETE FROM ss.site_graph WHERE sitearray_id = %s", (sa_id,))

    # Insert new site graph
    cur.execute("""
        INSERT INTO ss.site_graph (sitearray_id, json)
        VALUES (%s, %s)
    """, (sa_id, site_graph_json))

    print("✅ Site graph commissioned from file.")


if __name__ == "__main__":
    graph = load_site_graph()
    validate_graph(graph)
    insert_sitegraph(graph)
