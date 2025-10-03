import json
import psycopg2
import redis
from ..util.config import load_config

def get_postgres_conn():
    config = load_config()
    pg_conf = config["database"]["postgres"]
    return psycopg2.connect(
        dbname=pg_conf["dbname"],
        user=pg_conf["user"],
        password=pg_conf["password"],
        host=pg_conf["host"],
        port=pg_conf["port"]
    )

def get_redis_conn():
    config = load_config()
    rd_conf = config["database"]["redis"]
    return redis.StrictRedis(
        host=rd_conf["host"],
        port=rd_conf["port"],
        db=rd_conf.get("db", 3),
        decode_responses=True
    )

def main():
    site_name = "TEST"
    redis_key = f"sitegraph:{site_name}"

    pg_conn = get_postgres_conn()
    r_conn = get_redis_conn()

    try:
        with pg_conn.cursor() as cur:
            cur.execute("""
                SELECT json
                FROM site_graph
                JOIN site ON site_graph.site_id = site.id
                WHERE site.name = %s
            """, (site_name,))
            result = cur.fetchone()

            if not result:
                raise Exception(f"No site_graph found for site '{site_name}'")

            graph_json = result[0]

            # Validate required structure
            nodes = graph_json.get("nodes", [])
            if not nodes or not all("macaddr" in n and "x" in n and "y" in n for n in nodes):
                raise Exception("site_graph JSON is missing required 'nodes' structure with macaddr, x, y")

            # Write to Redis
            r_conn.set(redis_key, json.dumps(graph_json))
            print(f"✅ Loaded sitegraph:{site_name} into Redis with {len(nodes)} nodes.")

    finally:
        pg_conn.close()

if __name__ == "__main__":
    main()
