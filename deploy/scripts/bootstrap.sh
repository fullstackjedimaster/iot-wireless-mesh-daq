#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "\033[1;32m[bootstrap] $*\033[0m"; }
err() { echo -e "\033[1;31m[bootstrap] ERROR: $*\033[0m" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1"; }

# Tools we need inside cloud image
need psql
need python3

# If DATABASE_URL / REDIS_URL weren't provided, derive them from pieces.
derive_urls() {
  local pg_host="${POSTGRES_HOST:-postgres}"
  local pg_port="${POSTGRES_PORT:-5432}"
  local pg_db="${POSTGRES_DB:-ss}"
  local pg_user="${POSTGRES_USER:-ss}"
  local pg_pass="${POSTGRES_PASSWORD:-}"

  local r_host="${REDIS_HOST:-redis}"
  local r_port="${REDIS_PORT:-6379}"
  local r_db="${REDIS_DB:-3}"

  [[ -n "${DATABASE_URL:-}" ]] || export DATABASE_URL="postgresql://${pg_user}:${pg_pass}@${pg_host}:${pg_port}/${pg_db}"
  [[ -n "${REDIS_URL:-}" ]] || export REDIS_URL="redis://${r_host}:${r_port}/${r_db}"
}

derive_urls

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${REDIS_URL:?REDIS_URL is required}"

log "DATABASE_URL present (redacted)"
log "Running init-postgres..."
/deploy/scripts/init-postgres.sh

log "Seeding Redis from Postgres (idempotent)..."
/deploy/scripts/seed-redis.sh

log "Bootstrap complete."
