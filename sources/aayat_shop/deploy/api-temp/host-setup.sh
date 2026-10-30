#!/bin/bash
set -e
export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH
cd /home/kiaakala/api.kiaakala.ir
node node_modules/prisma/build/index.js db push --accept-data-loss
node node_modules/tsx/dist/cli.mjs prisma/seed.ts || npm install tsx --no-save && node node_modules/tsx/dist/cli.mjs prisma/seed.ts
pkill -f "api.kiaakala.ir/dist/index.js" || true
nohup node dist/index.js >> app.log 2>&1 &
sleep 2
curl -sS http://127.0.0.1:3001/api/health
