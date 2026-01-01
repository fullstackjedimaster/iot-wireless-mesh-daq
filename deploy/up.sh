#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

# Ensure env files exist (idempotent)
bash ./scripts/init-env.sh

# Bring stack up
docker compose up -d "$@"

echo
echo "[+] Stack is up."
docker compose ps
