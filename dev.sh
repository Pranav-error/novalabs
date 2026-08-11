#!/usr/bin/env bash
# Starts the backend (FastAPI/uvicorn, port 8570) and frontend (Next.js, port 8569)
# dev servers. For an Ubuntu VPS: binds both to 0.0.0.0 so they're reachable
# externally — open/forward these ports (or put them behind nginx) as needed.
#
# Usage: ./dev.sh
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PORT=8570
FRONTEND_PORT=8569

if [ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]; then
    echo "No backend/.venv found — creating one and installing requirements..."
    python3 -m venv "$BACKEND_DIR/.venv"
    "$BACKEND_DIR/.venv/bin/pip" install --quiet --upgrade pip
    "$BACKEND_DIR/.venv/bin/pip" install --quiet -r "$BACKEND_DIR/requirements.txt"
fi

cleanup() {
    echo "Stopping dev servers..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "Starting backend  -> http://0.0.0.0:$BACKEND_PORT"
(cd "$BACKEND_DIR" && ./.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port "$BACKEND_PORT") &
BACKEND_PID=$!

echo "Starting frontend -> http://0.0.0.0:$FRONTEND_PORT"
(cd "$FRONTEND_DIR" && npm run dev -- -p "$FRONTEND_PORT" -H 0.0.0.0) &
FRONTEND_PID=$!

wait
