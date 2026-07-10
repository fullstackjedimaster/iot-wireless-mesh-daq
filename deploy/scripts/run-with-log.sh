#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
    echo "Usage: run-with-log.sh LOG_FILE COMMAND [ARG ...]" >&2
    exit 64
}

[[ $# -ge 2 ]] || usage

LOG_FILE="$1"
shift

LOG_DIR="$(dirname -- "$LOG_FILE")"
mkdir -p -- "$LOG_DIR"
touch -- "$LOG_FILE"

{
    printf '[%s] starting:' "$(date -Is)"
    printf ' %q' "$@"
    printf '\n'
} | tee -a -- "$LOG_FILE"

set +e
"$@" 2>&1 | tee -a -- "$LOG_FILE"
command_status=${PIPESTATUS[0]}
set -e

printf '[%s] exited with status %s\n' "$(date -Is)" "$command_status" \
    | tee -a -- "$LOG_FILE"

exit "$command_status"
