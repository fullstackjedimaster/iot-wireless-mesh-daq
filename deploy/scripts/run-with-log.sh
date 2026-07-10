#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:?Missing log file path}"
shift

mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

printf '[%s] starting:' "$(date -Is)" | tee -a "$LOG_FILE"

for arg in "$@"; do
    printf ' %q' "$arg" | tee -a "$LOG_FILE"
done

printf '\n' | tee -a "$LOG_FILE"

"$@" 2>&1 | tee -a "$LOG_FILE"

exit "${PIPESTATUS[0]}"