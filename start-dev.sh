#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

BACKEND_CMD="cd \"$ROOT/backend\" && ./venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"
FRONTEND_CMD="cd \"$ROOT/frontend\" && npm run dev"

printf '\nStarting MarketRisk backend...\n'
(eval "$BACKEND_CMD") &
BACKEND_PID=$!

printf 'Starting MarketRisk frontend...\n'
(eval "$FRONTEND_CMD") &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID' EXIT

wait
