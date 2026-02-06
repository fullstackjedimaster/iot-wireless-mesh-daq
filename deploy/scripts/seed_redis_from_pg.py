#!/usr/bin/env python3
import os
import json
import sys
import redis
import psycopg

DATABASE_URL = os.environ.get("DATABASE_URL")
REDIS_URL = os.environ.get("REDIS_URL")
SITE_NAME = os.environ.get("SITE_NAME", "TEST")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL is required", file=sys.stderr)
    sys.exit(1)
if not REDIS_URL:
    print("ERROR: REDIS_URL is required", file=sys.stderr)
    sys.exit(1)

REDIS_KEY = f"sitegraph:{SITE_NAME}"

SQL = """
      SELECT sg.json
      FROM ss.site_graph sg
               JOIN ss.site_array sa ON sg.sitearray_id = sa.id
               JOIN ss.site s ON sa.site_id = s.id
      WHERE s.sitename = %s
      ORDER BY sg.id DESC
          LIMIT 1 \
      """

def main() -> int:
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(SQL, (SITE_NAME,))
            row = cur.fetchone()

    if not row or not row[0]:
        raise RuntimeError(f"No ss.site_graph found for site '{SITE_NAME}'")

    raw = row[0]
    graph = json.loads(raw)

    # Minimal sanity check: must have sitearray + inputs
    if not isinstance(graph, dict) or "sitearray" not in graph:
        raise RuntimeError("site_graph JSON missing 'sitearray' root object")

    r = redis.from_url(REDIS_URL, decode_responses=True)
    r.set(REDIS_KEY, json.dumps(graph))
    print(f"✅ Wrote {REDIS_KEY} to Redis.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
