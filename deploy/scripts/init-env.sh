#!/usr/bin/env bash
set -euo pipefail

# deploy/scripts/init-env.sh

ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../env" && pwd)"
SHARED_PORTFOLIO_ENV_DIR="/opt/stacks/portfolio/deploy/shared/env"

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
    python3 - <<'PY'
import secrets, base64
print(base64.b64encode(secrets.token_bytes(48)).decode().strip())
PY
  fi
}

copy_example() {
  local example="$1"
  local target="$2"

  cp -f "$example" "$target"
  log "Wrote fresh: $(basename "$target")"
}

replace_key() {
  local file="$1"
  local key="$2"
  local value="$3"

  sed -i -E "s|^(${key}=).*$|\1${value}|g" "$file"
}

read_key() {
  local file="$1"
  local key="$2"

  awk -F= -v k="$key" '$1 == k {print substr($0, index($0, "=") + 1)}' "$file" | tr -d '\r'
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

  log "ENV_DIR=$ENV_DIR"
  log "Copying examples..."

  for f in "${files[@]}"; do

    local example="${ENV_DIR}/${f}.example"
    local target="${ENV_DIR}/${f}"

    [[ -f "$example" ]] || err "Missing example file: $example"
    copy_example "$example" "$target"
  done

  local example="${SHARED_PORTFOLIO_ENV_DIR}/embed.env.example"
  local target="${ENV_DIR}/embed.env"
  copy_example "$example" "$target"

  local pg_file="${ENV_DIR}/postgres.env"
  local cloud_file="${ENV_DIR}/cloud.env"

  if grep -q '^POSTGRES_PASSWORD=CHANGE_ME' "$pg_file"; then
    local pg_pass
    pg_pass="$(gen_secret)"
    replace_key "$pg_file" "POSTGRES_PASSWORD" "$pg_pass"
    log "Generated POSTGRES_PASSWORD in $(basename "$pg_file")"
  fi

  if grep -q '^POSTGRES_PASSWORD=CHANGE_ME' "$cloud_file"; then
    local pg_pass_current
    pg_pass_current="$(read_key "$pg_file" "POSTGRES_PASSWORD")"
    replace_key "$cloud_file" "POSTGRES_PASSWORD" "$pg_pass_current"
    log "Copied POSTGRES_PASSWORD into $(basename "$cloud_file")"
  fi

  log "IoT env ready."
}

main "$@"