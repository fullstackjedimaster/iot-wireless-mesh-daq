#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

bash ./scripts/init-env.sh

docker compose down
docker compose build --no-cache cloud-image mesh daq-ui
docker compose up -d
docker compose ps
