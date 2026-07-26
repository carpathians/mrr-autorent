#!/bin/sh
set -eu

# Umbrel mounts ${APP_DATA_DIR}/data over /data — ensure writable for uid 1000
if [ -d /data ]; then
  if [ "$(id -u)" = "0" ]; then
    chown -R 1000:1000 /data || true
  fi
  if ! touch /data/.write-test 2>/dev/null; then
    echo "WARN: /data not writable, using /tmp/mrr-data" >&2
    mkdir -p /tmp/mrr-data
    export DATA_DIR=/tmp/mrr-data
  else
    rm -f /data/.write-test
  fi
fi

export DATA_DIR="${DATA_DIR:-/data}"
export HOST="${HOST:-0.0.0.0}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3001}"

# Default: Next standalone. Override with CMD for worker.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec node server.js
