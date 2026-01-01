#!/usr/bin/env bash
set -euo pipefail

# deploy/scripts/init-env.sh
# Creates deploy/env/*.env from *.env.example (idempotent).
# Generates secrets ONLY if placeholder/missing, never rotates unless FORCE=1.
#
# Usage:
#   cd /opt/stacks/iot-wireless-mesh-daq/deploy
#   bash ./scripts/init-env.sh
#
# Overwrite existing .env files (DANGEROUS: will rewrite values):
#   FORCE=1 bash ./scripts/init-env.sh
#
# Sync cloud POSTGRES_PASSWORD from postgres.env without regenerating:
#   SYNC=1 bash ./scripts/init-env.sh

ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../env" && pwd)"

log()  { echo -e "\033[1;32m[+] $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
err()  { echo -e "\033[1;31m[✗] $*\033[0m" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1"; }

need cp
need sed
need awk

gen_secret() {
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

  if [[ -f "$target" && "${FORCE:-0}" != "1" ]]; then
    log "Exists: $(basename "$target") (skipping; set FORCE=1 to overwrite)"
    return 0
  fi

  cp -f "$example" "$target"
  log "Wrote: $(basename "$target")"
}

replace_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  sed -i -E "s|^(${key}=).*$|\1${value}|g" "$file"
}

get_val() {
  local file="$1"
  local key="$2"
  awk -F= -v k="$key" '$1==k{print substr($0, index($0,"=")+1)}' "$file" | head -n1 | tr -d '\r'
}

is_placeholder_or_empty() {
  local v="$1"
  [[ -z "${v// }" || "$v" == "CHANGE_ME" ]]
}

main() {
  [[ -d "$ENV_DIR" ]] || err "Env dir not found: $ENV_DIR"

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

  local pg_file="${ENV_DIR}/postgres.env"
  local cloud_file="${ENV_DIR}/cloud.env"

  # Generate POSTGRES_PASSWORD if missing/placeholder (only)
  local pg_pass
  pg_pass="$(get_val "$pg_file" "POSTGRES_PASSWORD")"
  if is_placeholder_or_empty "$pg_pass"; then
    pg_pass="$(gen_secret)"
    replace_key "$pg_file" "POSTGRES_PASSWORD" "$pg_pass"
    log "Generated POSTGRES_PASSWORD in $(basename "$pg_file")"
  else
    log "POSTGRES_PASSWORD already set in $(basename "$pg_file")"
  fi

  # Sync cloud POSTGRES_PASSWORD from postgres.env:
  # - if cloud placeholder/missing OR SYNC=1
  local cloud_pass
  cloud_pass="$(get_val "$cloud_file" "POSTGRES_PASSWORD")"
  if [[ "${SYNC:-0}" == "1" || "$(is_placeholder_or_empty "$cloud_pass"; echo $?)" == "0" ]]; then
    replace_key "$cloud_file" "POSTGRES_PASSWORD" "$pg_pass"
    log "Synced POSTGRES_PASSWORD into $(basename "$cloud_file")"
  fi

  # Generate EMBED_SECRET if missing/placeholder (only)
  local embed
  embed="$(get_val "$cloud_file" "EMBED_SECRET")"
  if is_placeholder_or_empty "$embed"; then
    embed="$(gen_secret)"
    replace_key "$cloud_file" "EMBED_SECRET" "$embed"
    log "Generated EMBED_SECRET in $(basename "$cloud_file")"
  else
    log "EMBED_SECRET already set in $(basename "$cloud_file")"
  fi

  warn "Env files ready:"
  echo "  ${ENV_DIR}/postgres.env"
  echo "  ${ENV_DIR}/cloud.env"
  echo
  log "Next:"
  echo "  docker compose config >/dev/null && echo 'YAML OK'"
  echo "  docker compose up -d --build"
}

main "$@"
