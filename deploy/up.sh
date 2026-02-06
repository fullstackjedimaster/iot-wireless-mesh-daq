#!/usr/bin/env bash
set -euo pipefail

# Resolve deploy dir from this script's location
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_DIR="/opt/stacks/iot-wireless-mesh-daq"

COMPOSE_FILE="$DEPLOY_DIR/compose.yml"
SCRIPTS_DIR="$DEPLOY_DIR/scripts"
ENV_DIR="$DEPLOY_DIR/env"

# hard pin compose identity
COMPOSE_PROJECT_NAME="meshdaq"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo "[up] Deploy dir:    $DEPLOY_DIR"
echo "[up] Stack dir:     $STACK_DIR"
echo "[up] Compose file:  $COMPOSE_FILE"
echo "[up] Scripts dir:   $SCRIPTS_DIR"
echo "[up] Env dir:       $ENV_DIR"
echo "[up] Project name:  $COMPOSE_PROJECT_NAME"

[[ -d "$DEPLOY_DIR" ]] || { echo "[up][ERROR] Missing DEPLOY_DIR: $DEPLOY_DIR"; exit 1; }
[[ -d "$STACK_DIR"  ]] || { echo "[up][ERROR] Missing STACK_DIR: $STACK_DIR"; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "[up][ERROR] Missing compose.yml: $COMPOSE_FILE"; exit 1; }
[[ -d "$SCRIPTS_DIR" ]] || { echo "[up][ERROR] Missing scripts dir: $SCRIPTS_DIR"; exit 1; }

echo "[up] Generating env + secrets"
FORCE="${FORCE:-0}" bash "$SCRIPTS_DIR/init-env.sh"

if [[ "${NUKE_VOLUMES:-0}" == "1" ]]; then
  echo "[up] Stopping stack (REMOVING VOLUMES)"
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down -v --remove-orphans
else
  echo "[up] Stopping stack (keeping volumes)"
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" down --remove-orphans
fi

echo "[up] Building + starting stack"
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "[up] Done"
