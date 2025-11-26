#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${REPO_ROOT}/logs"
mkdir -p "${LOG_DIR}"

TS="$(date +%Y%m%d-%H%M%S)"
VITE_LOG="${LOG_DIR}/npm-dev-${TS}.log"
ELECTRON_LOG="${LOG_DIR}/electron-dev-${TS}.log"

echo "Starting Vite (console + ${VITE_LOG})"
echo "Will start Electron after Vite is ready (logs -> ${ELECTRON_LOG})"

cd "${REPO_ROOT}"

cleanup() {
  if [[ -n "${ELECTRON_PID:-}" ]] && kill -0 "${ELECTRON_PID}" 2>/dev/null; then
    kill "${ELECTRON_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Start Electron after Vite is ready (background, file-only logging)
(
  npx wait-on tcp:5173
  npx electron . >> "${ELECTRON_LOG}" 2>&1
) &
ELECTRON_PID=$!

# Start Vite in foreground; mirror to console and file
npm run dev | tee "${VITE_LOG}"
