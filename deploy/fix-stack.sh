#!/usr/bin/env bash
# Repair CRM frontend + backend on VPS. Run as root.
# curl -fsSL https://raw.githubusercontent.com/saman-alayee/crm_app/main/deploy/fix-stack.sh | bash
set -euo pipefail

APP_USER="crm"
APP_ROOT="/opt/crm"
APP_DIR="${APP_ROOT}/app"
DATA_DIR="${APP_ROOT}/data"
LOG_DIR="${APP_ROOT}/logs"
REPO_URL="${REPO_URL:-https://github.com/saman-alayee/crm_app.git}"
PUBLIC_HOST="${PUBLIC_HOST:-87.107.54.193}"
API_PORT=4000
WEB_PORT=3000
export DEBIAN_FRONTEND=noninteractive

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root" >&2
  exit 1
fi

echo "==> [1/8] Ensure base packages + node + pm2"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y --no-install-recommends ca-certificates curl git nginx ufw fail2ban build-essential python3 redis-server
fi
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2
systemctl enable --now redis-server 2>/dev/null || systemctl enable --now redis 2>/dev/null || true
systemctl enable --now nginx

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR" "$LOG_DIR" "$APP_ROOT/run"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"

echo "==> [2/8] Sync code from GitHub"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth=1 origin main
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "$APP_DIR"
  sudo -u "$APP_USER" git clone --depth=1 "$REPO_URL" "$APP_DIR"
fi
rm -rf "$APP_DIR/sources"

ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Creating .env"
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
  # Force correct production binds / public API URL
  sed -i "s|^HOST=.*|HOST=127.0.0.1|" "$ENV_FILE" || true
  grep -q '^HOST=' "$ENV_FILE" || echo 'HOST=127.0.0.1' >> "$ENV_FILE"
  sed -i "s|^PORT=.*|PORT=${API_PORT}|" "$ENV_FILE" || true
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$ENV_FILE" || true
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:${DATA_DIR}/prod.db\"|" "$ENV_FILE" || true
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://${PUBLIC_HOST},http://${PUBLIC_HOST}:80,http://127.0.0.1|" "$ENV_FILE" || true
  if grep -q '^NUXT_PUBLIC_API_BASE=' "$ENV_FILE"; then
    sed -i "s|^NUXT_PUBLIC_API_BASE=.*|NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1|" "$ENV_FILE"
  else
    echo "NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1" >> "$ENV_FILE"
  fi
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> [3/8] Install deps + prisma"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --omit=dev
sudo -u "$APP_USER" npm install --prefix apps/api
sudo -u "$APP_USER" npm install --prefix apps/dashboard
sudo -u "$APP_USER" npx prisma generate --schema prisma/schema.prisma
sudo -u "$APP_USER" DATABASE_URL="file:${DATA_DIR}/prod.db" npx prisma db push --schema prisma/schema.prisma --accept-data-loss
if [ ! -f "$DATA_DIR/.seeded" ]; then
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && npm run db:seed --prefix apps/api" || true
  touch "$DATA_DIR/.seeded"
  chown "$APP_USER:$APP_USER" "$DATA_DIR/.seeded"
fi
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

echo "==> [4/8] Build dashboard (Nuxt)"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/dashboard' && NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1 npm run build"
if [ ! -f "$APP_DIR/apps/dashboard/.output/server/index.mjs" ]; then
  echo "FATAL: Nuxt build missing .output/server/index.mjs" >&2
  exit 1
fi

echo "==> [5/8] Ensure admin saman"
SAMAN_PASS_FILE="$APP_ROOT/ADMIN_SAMAN.txt"
SAMAN_PASS="${ADMIN_SAMAN_PASSWORD:-Saman@Crm2026!}"
printf '%s\n' "$SAMAN_PASS" > "$SAMAN_PASS_FILE"
chmod 600 "$SAMAN_PASS_FILE"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && DATABASE_URL=\"file:${DATA_DIR}/prod.db\" node scripts/create-admin-user.mjs saman '$SAMAN_PASS' سامان ادمین" || true

echo "==> [6/8] PM2 ecosystem + restart"
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
      max_memory_restart: '400M',
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
      max_memory_restart: '450M',
      out_file: '${LOG_DIR}/web.out.log',
      error_file: '${LOG_DIR}/web.err.log',
      time: true,
      merge_logs: true,
    },
  ],
};
EOF
chown "$APP_USER:$APP_USER" "$APP_ROOT/ecosystem.config.cjs"

sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && pm2 delete crm-api crm-web 2>/dev/null || true"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && pm2 start '$APP_ROOT/ecosystem.config.cjs' && pm2 save"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null | tail -n 1 | bash || true

echo "==> [7/8] Nginx reverse proxy"
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
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /api/ {
        limit_req zone=crm_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
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
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location ~* /\.(env|git) { deny all; return 404; }
}
EOF
ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Firewall keep SSH + HTTP
if command -v ufw >/dev/null 2>&1; then
  SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
  SSH_PORT="${SSH_PORT:-22}"
  ufw allow "${SSH_PORT}/tcp" || true
  ufw allow 80/tcp || true
  ufw --force enable || true
fi

echo "==> [8/8] Cleanup + verify"
rm -rf "$APP_DIR/sources" /tmp/crm_app 2>/dev/null || true
if [ -f "$APP_DIR/deploy/harden-cleanup.sh" ]; then
  bash "$APP_DIR/deploy/harden-cleanup.sh" || true
fi

sleep 3
echo '--- PM2 ---'
sudo -u "$APP_USER" pm2 status || true
echo '--- listeners ---'
ss -lntp | grep -E ':(80|3000|4000) ' || true
echo '--- health ---'
curl -fsS --max-time 5 http://127.0.0.1:${API_PORT}/api/v1/health && echo || echo API_FAIL
curl -fsS -o /dev/null -w "web=%{http_code}\n" --max-time 5 http://127.0.0.1:${WEB_PORT}/ || echo WEB_FAIL
curl -fsS -o /dev/null -w "proxy=%{http_code}\n" --max-time 5 http://127.0.0.1/ || echo PROXY_FAIL

echo ""
echo "URL: http://${PUBLIC_HOST}/"
echo "Admin: saman / ${SAMAN_PASS}"
if [ -f "$APP_ROOT/CREDENTIALS.txt" ]; then
  echo -n "Owner: owner / "; cat "$APP_ROOT/CREDENTIALS.txt"; echo
fi
