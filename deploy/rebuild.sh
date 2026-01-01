#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

bash ./scripts/init-env.sh

docker compose -f compose.yml down
docker compose -f compose.yml build --no-cache cloud-image mesh daq-ui
docker compose -f compose.yml up -d
docker compose -f compose.yml ps
