#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${REDIS_URL:?REDIS_URL is required}"

SITE_NAME="${SITE_NAME:-TEST}"
REDIS_KEY="sitegraph:${SITE_NAME}"

echo "[seed-redis] Checking if Redis already has ${REDIS_KEY}..."

python3 - <<PY
import os, sys, redis
r = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
key = "${REDIS_KEY}"
exists = r.exists(key)
print(f"[seed-redis] EXISTS={exists}")
sys.exit(0 if exists else 1)
PY

# If exists => skip
if [[ $? -eq 0 ]]; then
  echo "[seed-redis] ${REDIS_KEY} already exists. Skipping (only runs on fresh Redis)."
  exit 0
fi

echo "[seed-redis] Seeding Redis from Postgres ss.site_graph..."
python3 /deploy/scripts/seed_redis_from_pg.py

echo "[seed-redis] Done."
