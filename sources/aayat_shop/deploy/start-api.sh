#!/bin/bash
APP="/home/kiaakala/api.kiaakala.ir"
NODE="/opt/alt/alt-nodejs20/root/usr/bin/node"
if [ -x "/home/kiaakala/nodevenv/api.kiaakala.ir/20/bin/node" ]; then
  NODE="/home/kiaakala/nodevenv/api.kiaakala.ir/20/bin/node"
fi

cd "$APP" || exit 1

pkill -f "api.kiaakala.ir/dist/index.js" 2>/dev/null || true
sleep 2

unset NODE_OPTIONS

setsid "$NODE" dist/index.js >> app.log 2>&1 &
echo "started pid $!"

sleep 6

PORT=3002
if [ -f .env ]; then
  PORT=$(grep -E '^PORT=' .env | head -1 | cut -d= -f2 | tr -d '"' | tr -d "'")
fi
PORT=${PORT:-3002}

curl -sS --max-time 8 "http://127.0.0.1:${PORT}/api/health" || true
echo
pgrep -af "dist/index.js" || true
