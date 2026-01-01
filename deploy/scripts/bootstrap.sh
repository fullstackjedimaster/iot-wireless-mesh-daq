#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "\033[1;32m[bootstrap] $*\033[0m"; }
err() { echo -e "\033[1;31m[bootstrap] ERROR: $*\033[0m" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1"; }

need bash
need psql
need python3
need redis-cli

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${REDIS_URL:?REDIS_URL is required}"

log "Starting bootstrap..."
log "DATABASE_URL is set"
log "REDIS_URL is set"

log "Step 1/2: init Postgres (idempotent)"
/deploy/scripts/init-postgres.sh

log "Step 2/2: seed Redis from Postgres (idempotent)"
/deploy/scripts/seed-redis.sh

log "Bootstrap complete."
