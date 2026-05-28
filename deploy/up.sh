#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

COMPOSE_PROJECT_NAME="$(basename "$(dirname "$DEPLOY_DIR")")"

PORTFOLIO_DEPLOY="/opt/stacks/portfolio/deploy"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker compose \
  -p "$COMPOSE_PROJECT_NAME" \
  -f "$DEPLOY_DIR"/compose.yml \
  down -v --remove-orphans

echo "[up] Initializing shared env"
bash "$PORTFOLIO_DEPLOY/shared/scripts/init-shared-env.sh"

echo "[up] Generating env + secrets"
bash "$DEPLOY_DIR/scripts/init-env.sh"

echo "[up] Loading env"

set -a

source "$PORTFOLIO_DEPLOY/shared/env/embed.env"
source "$DEPLOY_DIR/env/cloud.env"
source "$DEPLOY_DIR/env/daq-ui.env"

set +a

echo "[up] Building + starting stack"

docker compose \
  -p "$COMPOSE_PROJECT_NAME" \
  -f "$DEPLOY_DIR"/compose.yml \
  up -d --build

echo "[up] Done"

docker compose logs -f daq-ui cloud