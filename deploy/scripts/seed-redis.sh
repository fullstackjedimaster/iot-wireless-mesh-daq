#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${REDIS_URL:?REDIS_URL is required}"

SITE_NAME="${SITE_NAME:-TEST}"
REDIS_KEY="sitegraph:${SITE_NAME}"

echo "[seed-redis] Checking if Redis already has ${REDIS_KEY}..."

EXISTS="$(python3 - <<PY
import os, redis
r = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
key = "${REDIS_KEY}"
exists = int(r.exists(key))
print(exists)
PY
)"

echo "[seed-redis] EXISTS=${EXISTS}"

if [[ "${EXISTS}" == "1" ]]; then
  echo "[seed-redis] ${REDIS_KEY} already exists. Skipping (only runs on fresh Redis)."
  exit 0
fi

echo "[seed-redis] Seeding Redis from Postgres ss.site_graph..."
python3 /deploy/scripts/seed_redis_from_pg.py

echo "[seed-redis] Done."
