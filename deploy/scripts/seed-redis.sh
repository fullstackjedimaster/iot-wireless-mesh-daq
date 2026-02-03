#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# Resolve Postgres connection (same rules as init-postgres.sh)
# Supports:
#   1) DATABASE_URL (legacy)
#   2) POSTGRES_HOST/POSTGRES_PORT/POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD
#   3) DATABASE_HOST/DATABASE_PORT + POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD
# ------------------------------------------------------------

DATABASE_URL="${DATABASE_URL:-}"

POSTGRES_HOST="${POSTGRES_HOST:-${DATABASE_HOST:-}}"
POSTGRES_PORT="${POSTGRES_PORT:-${DATABASE_PORT:-5432}}"
POSTGRES_DB="${POSTGRES_DB:-}"
POSTGRES_USER="${POSTGRES_USER:-}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

if [[ -z "${DATABASE_URL}" ]]; then
  : "${POSTGRES_HOST:?POSTGRES_HOST (or DATABASE_HOST) is required}"
  : "${POSTGRES_PORT:?POSTGRES_PORT (or DATABASE_PORT) is required}"
  : "${POSTGRES_DB:?POSTGRES_DB is required}"
  : "${POSTGRES_USER:?POSTGRES_USER is required}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

  export PGPASSWORD="${POSTGRES_PASSWORD}"
  DATABASE_URL="postgresql://${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
fi

: "${REDIS_URL:?REDIS_URL is required}"

SITE_NAME="${SITE_NAME:-TEST}"
REDIS_KEY="sitegraph:${SITE_NAME}"

echo "[seed-redis] Checking if Redis already has ${REDIS_KEY}..."
if redis-cli -u "$REDIS_URL" EXISTS "$REDIS_KEY" | grep -q '^1$'; then
  echo "[seed-redis] ${REDIS_KEY} already exists. Skipping (only runs on fresh Redis)."
  exit 0
fi

echo "[seed-redis] Seeding Redis from Postgres ss.site_graph..."
export DATABASE_URL
python3 /deploy/scripts/seed_redis_from_pg.py

echo "[seed-redis] Done."
