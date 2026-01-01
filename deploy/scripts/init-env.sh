#!/usr/bin/env bash
set -euo pipefail

# Creates deploy/env/*.env from *.env.example (idempotent).
# Generates strong secrets for POSTGRES_PASSWORD + EMBED_SECRET.
# Also auto-derives DATABASE_URL and REDIS_URL in cloud.env + mesh.env.

ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../env" && pwd)"

log() { echo -e "\033[1;32m[+] $*\033[0m"; }
warn() { echo -e "\033[1;33m[!] $*\033[0m"; }
err() { echo -e "\033[1;31m[✗] $*\033[0m" >&2; exit 1; }

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

get_kv() {
  local file="$1" key="$2"
  awk -F= -v k="$key" '$1==k {print $2}' "$file" | tail -n 1 | tr -d '\r'
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
  local mesh_file="${ENV_DIR}/mesh.env"

  # --- Postgres password ---
  if grep -q '^POSTGRES_PASSWORD=CHANGE_ME' "$pg_file"; then
    local pg_pass
    pg_pass="$(gen_secret)"
    replace_key "$pg_file" "POSTGRES_PASSWORD" "$pg_pass"
    log "Generated POSTGRES_PASSWORD in $(basename "$pg_file")"
  else
    log "POSTGRES_PASSWORD already set in $(basename "$pg_file")"
  fi

  # Copy pg creds into cloud.env if placeholders
  if grep -q '^POSTGRES_PASSWORD=CHANGE_ME' "$cloud_file"; then
    local pg_pass_current
    pg_pass_current="$(get_kv "$pg_file" "POSTGRES_PASSWORD")"
    replace_key "$cloud_file" "POSTGRES_PASSWORD" "$pg_pass_current"
    log "Copied POSTGRES_PASSWORD into $(basename "$cloud_file")"
  fi

  # --- Embed secret ---
  if grep -q '^EMBED_SECRET=CHANGE_ME' "$cloud_file"; then
    local embed
    embed="$(gen_secret)"
    replace_key "$cloud_file" "EMBED_SECRET" "$embed"
    log "Generated EMBED_SECRET in $(basename "$cloud_file")"
  else
    log "EMBED_SECRET already set in $(basename "$cloud_file")"
  fi

  # --- Derive DATABASE_URL + REDIS_URL in cloud.env + mesh.env ---
  local db host port user pass redis_db redis_host redis_port dbname
  host="$(get_kv "$cloud_file" "POSTGRES_HOST")"; [[ -n "$host" ]] || host="postgres"
  port="$(get_kv "$cloud_file" "POSTGRES_PORT")"; [[ -n "$port" ]] || port="5432"
  dbname="$(get_kv "$cloud_file" "POSTGRES_DB")"; [[ -n "$dbname" ]] || dbname="ss"
  user="$(get_kv "$cloud_file" "POSTGRES_USER")"; [[ -n "$user" ]] || user="ss"
  pass="$(get_kv "$cloud_file" "POSTGRES_PASSWORD")"; [[ -n "$pass" ]] || pass="$(get_kv "$pg_file" "POSTGRES_PASSWORD")"

  redis_host="$(get_kv "$cloud_file" "REDIS_HOST")"; [[ -n "$redis_host" ]] || redis_host="redis"
  redis_port="$(get_kv "$cloud_file" "REDIS_PORT")"; [[ -n "$redis_port" ]] || redis_port="6379"
  redis_db="$(get_kv "$cloud_file" "REDIS_DB")"; [[ -n "$redis_db" ]] || redis_db="3"

  local db_url redis_url
  db_url="postgresql://${user}:${pass}@${host}:${port}/${dbname}"
  redis_url="redis://${redis_host}:${redis_port}/${redis_db}"

  # Always set these so they never drift
  if grep -q '^DATABASE_URL=' "$cloud_file"; then
    replace_key "$cloud_file" "DATABASE_URL" "$db_url"
  else
    echo "DATABASE_URL=${db_url}" >> "$cloud_file"
  fi

  if grep -q '^REDIS_URL=' "$cloud_file"; then
    replace_key "$cloud_file" "REDIS_URL" "$redis_url"
  else
    echo "REDIS_URL=${redis_url}" >> "$cloud_file"
  fi

  # mesh env: set REDIS_URL if present, else append
  if grep -q '^REDIS_URL=' "$mesh_file"; then
    replace_key "$mesh_file" "REDIS_URL" "$redis_url"
  else
    echo "REDIS_URL=${redis_url}" >> "$mesh_file"
  fi

  warn "Env files ready:"
  echo "  ${ENV_DIR}/postgres.env"
  echo "  ${ENV_DIR}/cloud.env"
  echo "  ${ENV_DIR}/mesh.env"
  echo
  log "Done."
}

main "$@"
