 #!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:?Missing log file path}"
shift

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

echo "[$(date -Is)] starting: $*" >> "$LOG_FILE"

exec "$@" 2>&1 | tee -a "$LOG_FILE"