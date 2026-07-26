#!/usr/bin/env bash
# Fresh DATA_DIR so the first-run API key wizard shows up.
set -euo pipefail
cd "$(dirname "$0")/.."

DIR="${DATA_DIR:-$(pwd)/.data-fresh}"
rm -rf "$DIR"
mkdir -p "$DIR"
export DATA_DIR="$DIR"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3001}"

echo "Fresh setup wizard test — DATA_DIR=${DATA_DIR}"
echo "Open http://127.0.0.1:${PORT} (expect first-run walkthrough)"
exec ./scripts/dev.sh
