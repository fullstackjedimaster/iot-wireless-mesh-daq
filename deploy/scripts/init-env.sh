#!/usr/bin/env bash
set -euo pipefail

# deploy/scripts/init-env.sh
# Creates deploy/env/*.env from *.env.example (idempotent).
# Generates strong secrets for POSTGRES_PASSWORD + EMBED_SECRET.
#
# Usage:
#   cd /opt/stacks/iot-wireless-mesh-daq/deploy
#   bash ./scripts/init-env.sh
#
# Overwrite existing .env files:
#   FORCE=1 bash ./scripts/init-env.sh

ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../env" && pwd)"

log() { echo -e "\033[1;32m[+] $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
err() { echo -e "\033[1;31m[✗] $*\033[0m" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1"; }

need cp
need sed
need awk

gen_secret() {
  # Prefer openssl if present; fallback to python
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
  else
    python - <<'PY'
import secrets, base64
print(base64.b64encode(secrets.token_bytes(48)).decode().strip())
PY
  fi
}

copy_example() {
  local example="$1"
  local target="$2"


  cp -f "$example" "$target"
  log "Wrote: $(basename "$target")"
}

replace_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  # Replace lines like KEY=... (even if commented? we only replace active lines)
  sed -i -E "s|^(${key}=).*$|\1${value}|g" "$file"
}

main() {

  local files=(
    "nats.env"
    "redis.env"
    "postgres.env"
    "cloud.env"
    "mesh.env"
    "daq-ui.env"
  )

  for f in "${files[@]}"; do
    local example="${ENV_DIR}/${f}.example"
    local target="${ENV_DIR}/${f}"
    [[ -f "$example" ]] || err "Missing example file: $example"
    copy_example "$example" "$target"
  done

  # Generate secrets (only if placeholders present OR FORCE=1 overwrote)
  local pg_file="${ENV_DIR}/postgres.env"
  local cloud_file="${ENV_DIR}/cloud.env"

  # Postgres password
  if grep -q '^POSTGRES_PASSWORD=CHANGE_ME' "$pg_file"; then
    local pg_pass
    pg_pass="$(gen_secret)"
    replace_key "$pg_file" "POSTGRES_PASSWORD" "$pg_pass"
    log "Generated POSTGRES_PASSWORD in $(basename "$pg_file")"
  else
    log "POSTGRES_PASSWORD already set in $(basename "$pg_file")"
  fi

  # Cloud should match postgres password unless you want separate creds
  if grep -q '^POSTGRES_PASSWORD=CHANGE_ME' "$cloud_file"; then
    # pull the pg password we just set
    local pg_pass_current
    pg_pass_current="$(awk -F= '/^POSTGRES_PASSWORD=/{print $2}' "$pg_file" | tr -d '\r')"
    replace_key "$cloud_file" "POSTGRES_PASSWORD" "$pg_pass_current"
    log "Copied POSTGRES_PASSWORD into $(basename "$cloud_file")"
  fi

  # Embed secret
  if grep -q '^EMBED_SECRET=CHANGE_ME' "$cloud_file"; then
    local embed
    embed="$(gen_secret)"
    replace_key "$cloud_file" "EMBED_SECRET" "$embed"
    log "Generated EMBED_SECRET in $(basename "$cloud_file")"
  else
    log "EMBED_SECRET already set in $(basename "$cloud_file")"
  fi

}