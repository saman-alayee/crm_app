#!/bin/bash
set -e
cd "$(dirname "$0")"
npm install --omit=dev
npx prisma generate
npx prisma db push
npm run db:seed
echo "Setup complete"
