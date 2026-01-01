#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

# Always ensure env files exist (idempotent)
bash ./scripts/init-env.sh

docker compose -f compose.yml up -d "$@"
docker compose -f compose.yml ps
