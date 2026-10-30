#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/kiaakala/src}"
API_DIR="${API_DIR:-/opt/kiaakala/api}"
WEB_DIR="${WEB_DIR:-/var/www/kiaakala}"
NGINX_SRC="$REPO_DIR/deploy/vps/nginx-jetkala.conf"
NGINX_SITE="jetkala"

cd "$REPO_DIR"

echo "==> Backend install/build"
cd "$REPO_DIR/backend"
npm ci
npx prisma generate
npm run build

mkdir -p "$API_DIR/uploads"
cp -a "$REPO_DIR/backend/dist" "$API_DIR/"
cp -a "$REPO_DIR/backend/package.json" "$API_DIR/"
cp -a "$REPO_DIR/backend/package-lock.json" "$API_DIR/"
cp -a "$REPO_DIR/backend/prisma" "$API_DIR/"

if [ ! -f "$API_DIR/.env" ]; then
  echo "Missing $API_DIR/.env" >&2
  exit 1
fi

cd "$API_DIR"
# Keep existing secrets; only force production OTP mode.
python3 - <<'PY'
from pathlib import Path
p = Path('/opt/kiaakala/api/.env')
lines = p.read_text(encoding='utf-8').splitlines()
out = []
seen = False
for ln in lines:
    if ln.startswith('OTP_DEV_MODE='):
        out.append('OTP_DEV_MODE=false')
        seen = True
    else:
        out.append(ln)
if not seen:
    out.append('OTP_DEV_MODE=false')
p.write_text('\n'.join(out) + '\n', encoding='utf-8')
print('ENV_OK OTP_DEV_MODE=false')
PY
chmod 600 .env
npm ci --omit=dev
npx prisma generate
npx prisma db push --accept-data-loss
npx tsx scripts/backfill-product-associations.ts 2>/dev/null || node -e "console.log('BACKFILL_SKIP')"

node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const samples = [
  { title: 'تخفیف ویژه لبنیات', image: '/images/sliders/dairy-sale.png', linkUrl: '/categories/labaniat', sortOrder: 1, placement: 'HOME_TOP' },
  { title: 'ارسال رایگان در کیاشهر', image: '/images/sliders/free-shipping.png', linkUrl: '/', sortOrder: 2, placement: 'HOME_TOP' },
  { title: 'میوه و سبزی تازه روز', image: '/images/sliders/fresh.png', linkUrl: '/categories/mive-sabzi', sortOrder: 3, placement: 'HOME_TOP' },
];
(async () => {
  const count = await prisma.slider.count({ where: { placement: 'HOME_TOP' } });
  if (count === 0) {
    await prisma.slider.createMany({ data: samples.map((s) => ({ ...s, isActive: true })) });
    console.log('SLIDERS_SEEDED');
  } else {
    for (const s of samples) {
      const existing = await prisma.slider.findFirst({ where: { title: s.title } });
      if (existing) {
        await prisma.slider.update({
          where: { id: existing.id },
          data: { image: s.image, linkUrl: s.linkUrl, isActive: true, placement: 'HOME_TOP' },
        });
      }
    }
    console.log('SLIDERS_UPDATED count=' + count);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE

echo "==> Frontend generate"
cd "$REPO_DIR/frontend"
export NUXT_PUBLIC_API_BASE="/api"
if [ -f .env.production ]; then set -a; . ./.env.production; set +a; fi
npm ci
npm run generate

mkdir -p "$WEB_DIR"
find "$WEB_DIR" -mindepth 1 -maxdepth 1 ! -name 'uploads' -exec rm -rf {} +
cp -a "$REPO_DIR/frontend/.output/public/." "$WEB_DIR/"
chown -R www-data:www-data "$WEB_DIR"

if [ -f "$NGINX_SRC" ]; then
  cp "$NGINX_SRC" "/etc/nginx/sites-available/$NGINX_SITE"
  ln -sfn "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE"
  rm -f /etc/nginx/sites-enabled/kiaakala
  nginx -t && systemctl reload nginx
fi

cd "$API_DIR"
# Inject .env into the process so Prisma always sees DATABASE_URL (PM2 does not load .env).
python3 - <<'PY'
from pathlib import Path
src = Path('/opt/kiaakala/api/.env')
dst = Path('/tmp/kiaakala-api-pm2.env')
lines = []
for raw in src.read_text(encoding='utf-8').splitlines():
    line = raw.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    key = key.strip()
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in '\'"':
        value = value[1:-1]
    escaped = value.replace('\\', '\\\\').replace('"', '\\"')
    lines.append(f'{key}="{escaped}"')
dst.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('PM2_ENV_KEYS', len(lines))
PY
set -a
# shellcheck disable=SC1091
. /tmp/kiaakala-api-pm2.env
set +a
pm2 delete kiaakala-api 2>/dev/null || true
pm2 start dist/index.js --name kiaakala-api --cwd "$API_DIR"
pm2 save

sleep 2
echo "==> Smoke tests"
curl -sS http://127.0.0.1:3001/api/health; echo
curl -sS -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1/
curl -sS -o /dev/null -w 'slider:%{http_code}\n' http://127.0.0.1/images/sliders/dairy-sale.png
curl -sS -o /dev/null -w 'password:%{http_code}\n' http://127.0.0.1/profile/password
pm2 status
echo "DEPLOY_OK"
