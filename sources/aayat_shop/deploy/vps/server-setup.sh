#!/bin/bash
set -euo pipefail

APP_ROOT="/opt/kiaakala"
API_DIR="$APP_ROOT/api"
WEB_ROOT="/var/www/kiaakala"
DOMAIN="kiaakala.ir"
DB_NAME="kiaakala"
DB_USER="kiaakala"

echo "==> System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx mysql-server certbot python3-certbot-nginx ufw openssl

if [ ! -f /swapfile ]; then
  echo "==> Adding 2G swap"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "==> Installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

npm install -g pm2

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> MySQL database"
if [ ! -f "$APP_ROOT/.db-config" ]; then
  DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
  mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
  mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
  mysql -e "FLUSH PRIVILEGES;"
  printf 'DB_PASS=%s\n' "$DB_PASS" > "$APP_ROOT/.db-config"
  chmod 600 "$APP_ROOT/.db-config"
fi
# shellcheck disable=SC1091
source "$APP_ROOT/.db-config"

cat > "$API_DIR/.env" <<EOF
PORT=3001
NODE_ENV=production
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@localhost:3306/${DB_NAME}"
REDIS_DISABLED=true
JWT_SECRET=kiaakala-hypermarket-prod-2026-x9Kp2mN8vQ4wR7tL
JWT_EXPIRES_IN=7d
OTP_EXPIRES_MINUTES=5
OTP_DEV_MODE=false
FARAZSMS_API_KEY=eCnzKQeW27Uky0ubGYomLOa5zH06hxdCGxKTCiOlauM0uPml2X
FARAZSMS_PATTERN_CODE=ZKAFa6RmXD
FARAZSMS_LINE_NUMBER=90008361
FARAZSMS_NUMBER_FORMAT=english
FARAZSMS_OTP_ATTRIBUTE=code
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
CORS_ORIGIN=https://kiaakala.ir,https://www.kiaakala.ir,http://kiaakala.ir,http://www.kiaakala.ir,http://45.94.215.57
ADMIN_PHONE=09120000000
ADMIN_PASSWORD=admin1234
EOF
chmod 600 "$API_DIR/.env"

mkdir -p "$API_DIR" "$WEB_ROOT" "$API_DIR/uploads"
chown -R www-data:www-data "$WEB_ROOT" "$API_DIR/uploads" 2>/dev/null || true

echo "==> Nginx site"
cp /tmp/nginx-kiaakala.conf /etc/nginx/sites-available/kiaakala
ln -sf /etc/nginx/sites-available/kiaakala /etc/nginx/sites-enabled/kiaakala
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Backend dependencies"
cd "$API_DIR"
npm ci --omit=dev
npx prisma generate
npx prisma db push --accept-data-loss

if [ -f prisma/seed.ts ]; then
  npm install --no-save tsx typescript @types/node
  npx tsx prisma/seed.ts || true
fi

echo "==> PM2 API"
pm2 delete kiaakala-api 2>/dev/null || true
pm2 start dist/index.js --name kiaakala-api --cwd "$API_DIR"
pm2 save
pm2 startup systemd -u root --hp /root >/tmp/pm2-startup.sh
bash /tmp/pm2-startup.sh || true

echo "==> Health check"
sleep 2
curl -sf http://127.0.0.1:3001/api/health

echo "SETUP_OK"
