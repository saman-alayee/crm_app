#!/usr/bin/env bash
# Run on VPS as root after repo is at /opt/crm/app (or will clone).
set -euo pipefail

PUBLIC_HOST="${PUBLIC_HOST:-87.107.54.193}"
ADMIN_SAMAN_PASSWORD="${ADMIN_SAMAN_PASSWORD:-Saman@Crm2026!}"
APP_USER="crm"
APP_ROOT="/opt/crm"
APP_DIR="${APP_ROOT}/app"
DATA_DIR="${APP_ROOT}/data"
LOG_DIR="${APP_ROOT}/logs"
API_PORT=4000
WEB_PORT=3000
REPO_URL="${REPO_URL:-https://github.com/saman-alayee/crm_app.git}"
export DEBIAN_FRONTEND=noninteractive

echo "==> Swap (1GB RAM)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show || true

echo "==> apt packages"
sed -i 's|http://archive.ubuntu.com/ubuntu|http://mirror.iranserver.com/ubuntu|g' /etc/apt/sources.list 2>/dev/null || true
sed -i 's|http://security.ubuntu.com/ubuntu|http://mirror.iranserver.com/ubuntu|g' /etc/apt/sources.list 2>/dev/null || true
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl git nginx ufw fail2ban build-essential python3 redis-server xz-utils openssl
systemctl enable --now nginx || true
systemctl enable --now redis-server 2>/dev/null || systemctl enable --now redis 2>/dev/null || true

echo "==> Node 22"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  cd /tmp
  VER=v22.14.0
  FILE="node-${VER}-linux-x64.tar.xz"
  ok=0
  if [ -f "/tmp/${FILE}" ] && [ "$(wc -c < "/tmp/${FILE}")" -gt 1000000 ]; then
    echo "using uploaded /tmp/${FILE}"
    ok=1
  else
    rm -f "$FILE"
    for url in \
      "https://nodejs.org/dist/${VER}/${FILE}" \
      "https://npmmirror.com/mirrors/node/${VER}/${FILE}"
    do
      echo "download $url"
      if curl -fL --connect-timeout 20 --max-time 400 -o "$FILE" "$url"; then
        ok=1
        break
      fi
    done
  fi
  [ "$ok" = 1 ] || { echo "node download failed"; exit 1; }
  tar -xJf "$FILE" -C /usr/local --strip-components=1
fi
hash -r || true
node -v
npm -v
npm install -g pm2

echo "==> App user + clone"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$DATA_DIR" "$LOG_DIR" "$APP_ROOT/run" "$APP_ROOT"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
if [ -f /tmp/crm-app-src.tgz ]; then
  echo "using uploaded /tmp/crm-app-src.tgz"
  rm -rf "$APP_DIR"
  mkdir -p "$APP_DIR"
  tar -xzf /tmp/crm-app-src.tgz -C "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
elif [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth=1 origin main
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "$APP_DIR"
  sudo -u "$APP_USER" git clone --depth=1 "$REPO_URL" "$APP_DIR"
fi
rm -rf "$APP_DIR/sources"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  ACCESS_SECRET="$(openssl rand -hex 32)"
  REFRESH_SECRET="$(openssl rand -hex 32)"
  BOT_KEY="$(openssl rand -hex 24)"
  BANK_KEY="$(openssl rand -hex 32)"
  OWNER_PASS="$(openssl rand -base64 14 | tr -d '/+=' | cut -c1-12)Aa1"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=${API_PORT}
DATABASE_URL="file:${DATA_DIR}/prod.db"
REDIS_URL=redis://127.0.0.1:6379
CORS_ORIGINS=http://${PUBLIC_HOST},http://${PUBLIC_HOST}:80,http://127.0.0.1
JWT_ACCESS_SECRET=${ACCESS_SECRET}
JWT_REFRESH_SECRET=${REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BANK_DATA_ENCRYPTION_KEY=${BANK_KEY}
BOT_INTERNAL_API_KEY=${BOT_KEY}
TELEGRAM_BOT_TOKEN=
SEED_OWNER_USERNAME=owner
SEED_OWNER_PASSWORD=${OWNER_PASS}
SEED_OWNER_EMAIL=owner@${PUBLIC_HOST}
AUDIT_RETENTION_DAYS=90
NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1
EOF
  echo "$OWNER_PASS" > "$APP_ROOT/CREDENTIALS.txt"
  chmod 600 "$APP_ROOT/CREDENTIALS.txt"
else
  sed -i "s|^HOST=.*|HOST=127.0.0.1|" "$ENV_FILE" || true
  grep -q '^HOST=' "$ENV_FILE" || echo 'HOST=127.0.0.1' >> "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:${DATA_DIR}/prod.db\"|" "$ENV_FILE"
  if grep -q '^NUXT_PUBLIC_API_BASE=' "$ENV_FILE"; then
    sed -i "s|^NUXT_PUBLIC_API_BASE=.*|NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1|" "$ENV_FILE"
  else
    echo "NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1" >> "$ENV_FILE"
  fi
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://${PUBLIC_HOST},http://${PUBLIC_HOST}:80,http://127.0.0.1|" "$ENV_FILE"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> npm install"
cd "$APP_DIR"
npm config set fetch-retries 5
npm config set fetch-timeout 300000
REG=https://registry.npmmirror.com
sudo -u "$APP_USER" npm install --omit=dev --registry="$REG" || sudo -u "$APP_USER" npm install --omit=dev
sudo -u "$APP_USER" npm install --prefix apps/api --registry="$REG" || sudo -u "$APP_USER" npm install --prefix apps/api
sudo -u "$APP_USER" npm install --prefix apps/dashboard --registry="$REG" || sudo -u "$APP_USER" npm install --prefix apps/dashboard

echo "==> prisma"
sudo -u "$APP_USER" npx prisma generate --schema prisma/schema.prisma
sudo -u "$APP_USER" DATABASE_URL="file:${DATA_DIR}/prod.db" npx prisma db push --schema prisma/schema.prisma --accept-data-loss
if [ ! -f "$DATA_DIR/.seeded" ]; then
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && npm run db:seed --prefix apps/api" || true
  touch "$DATA_DIR/.seeded"
  chown "$APP_USER:$APP_USER" "$DATA_DIR/.seeded"
fi
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

echo "==> build dashboard"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/dashboard' && NODE_OPTIONS=--max-old-space-size=768 NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1 npm run build"
test -f "$APP_DIR/apps/dashboard/.output/server/index.mjs"

echo "==> admin saman"
printf '%s\n' "$ADMIN_SAMAN_PASSWORD" > "$APP_ROOT/ADMIN_SAMAN.txt"
chmod 600 "$APP_ROOT/ADMIN_SAMAN.txt"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && DATABASE_URL=\"file:${DATA_DIR}/prod.db\" node scripts/create-admin-user.mjs saman '$ADMIN_SAMAN_PASSWORD' سامان ادمین" || true

echo "==> pm2"
cat > "$APP_ROOT/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: 'crm-api',
      cwd: '${APP_DIR}/apps/api',
      script: 'npx',
      args: 'tsx src/index.ts',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '${API_PORT}',
        DOTENV_CONFIG_PATH: '${APP_DIR}/.env',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '350M',
      out_file: '${LOG_DIR}/api.out.log',
      error_file: '${LOG_DIR}/api.err.log',
      time: true,
      merge_logs: true,
    },
    {
      name: 'crm-web',
      cwd: '${APP_DIR}/apps/dashboard',
      script: 'node',
      args: '.output/server/index.mjs',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '${WEB_PORT}',
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: '${WEB_PORT}',
        NUXT_PUBLIC_API_BASE: 'http://${PUBLIC_HOST}/api/v1',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '350M',
      out_file: '${LOG_DIR}/web.out.log',
      error_file: '${LOG_DIR}/web.err.log',
      time: true,
      merge_logs: true,
    },
  ],
};
EOF
chown "$APP_USER:$APP_USER" "$APP_ROOT/ecosystem.config.cjs"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && pm2 delete crm-api crm-web 2>/dev/null || true; pm2 start '$APP_ROOT/ecosystem.config.cjs'; pm2 save"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null | tail -n 1 | bash || true

echo "==> nginx"
cat > /etc/nginx/sites-available/crm <<EOF
limit_req_zone \$binary_remote_addr zone=crm_api:10m rate=10r/s;
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PUBLIC_HOST} _;
    client_max_body_size 10m;
    server_tokens off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    location /api/ {
        limit_req zone=crm_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:${API_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
SSH_PORT="${SSH_PORT:-9011}"
ufw allow "${SSH_PORT}/tcp" || true
ufw allow 80/tcp || true
ufw --force enable || true

sleep 4
echo "==> VERIFY"
sudo -u "$APP_USER" pm2 status || true
ss -lntp | grep -E ':(80|3000|4000) ' || true
curl -fsS --max-time 5 "http://127.0.0.1:${API_PORT}/api/v1/health" || echo API_FAIL
echo
curl -fsS -o /dev/null -w "web=%{http_code}\n" --max-time 5 "http://127.0.0.1:${WEB_PORT}/" || echo WEB_FAIL
curl -fsS -o /dev/null -w "proxy=%{http_code}\n" --max-time 5 http://127.0.0.1/ || echo PROXY_FAIL
echo -n "saman / "; cat "$APP_ROOT/ADMIN_SAMAN.txt"; echo
echo -n "owner / "; cat "$APP_ROOT/CREDENTIALS.txt"; echo
echo "URL: http://${PUBLIC_HOST}/"
