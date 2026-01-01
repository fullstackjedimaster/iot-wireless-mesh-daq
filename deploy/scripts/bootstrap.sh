#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "\033[1;32m[bootstrap] $*\033[0m"; }
err() { echo -e "\033[1;31m[bootstrap] $*\033[0m" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1"; }

need psql
need python3

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${REDIS_URL:?REDIS_URL is required}"

log "Running Postgres init (idempotent)…"
/deploy/scripts/init-postgres.sh

log "Seeding Redis from Postgres (idempotent)…"
/deploy/scripts/seed-redis.sh

log "Bootstrap complete."
