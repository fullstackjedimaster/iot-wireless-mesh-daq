#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_PROJECT_NAME="$(basename "$(dirname "$DEPLOY_DIR")")"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$DEPLOY_DIR"/compose.yml down -v --remove-orphans

echo "[up] Building + starting stack"
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$DEPLOY_DIR"/compose.yml up -d --build --remove-orphans

echo "[up] Done"
