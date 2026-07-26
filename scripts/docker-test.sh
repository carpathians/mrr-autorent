#!/usr/bin/env bash
# Build/run the prod image locally and smoke-test it (Umbrel-parity).
set -euo pipefail
cd "$(dirname "$0")/.."

if ! docker info >/dev/null 2>&1; then
  echo "FAIL: cannot talk to Docker (socket permission / daemon down)." >&2
  echo "  Fix: add your user to the docker group, or run with a user that can access /var/run/docker.sock" >&2
  echo "  Then: npm run docker:test" >&2
  exit 1
fi

docker compose up -d --build
node scripts/smoke-test.mjs http://127.0.0.1:3001
echo "docker:test OK → http://127.0.0.1:3001"
