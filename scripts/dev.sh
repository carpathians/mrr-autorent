#!/usr/bin/env bash
# Run Next web (:3001) + worker together for local development.
set -euo pipefail
cd "$(dirname "$0")/.."

export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3001}"
export DATA_DIR="${DATA_DIR:-$(pwd)/data}"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

mkdir -p "$DATA_DIR"

echo "Next   → http://127.0.0.1:${PORT}  (DATA_DIR=${DATA_DIR})"
echo "Worker → candidates 60s / rent loop"
echo

npm run worker &
npm run dev
