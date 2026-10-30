#!/usr/bin/env bash
# Production bootstrap for HR CRM on a bare Linux VPS (HTTP, no SSL).
# Run as root: bash server-setup.sh
set -euo pipefail

APP_USER="crm"
APP_ROOT="/opt/crm"
APP_DIR="${APP_ROOT}/app"
DATA_DIR="${APP_ROOT}/data"
LOG_DIR="${APP_ROOT}/logs"
REPO_URL="${REPO_URL:-https://github.com/saman-alayee/crm_app.git}"
PUBLIC_HOST="${PUBLIC_HOST:-87.107.54.193}"
PUBLIC_PORT="${PUBLIC_PORT:-80}"
API_PORT=4000
WEB_PORT=3000

export DEBIAN_FRONTEND=noninteractive

echo "==> Detecting OS"
if [ -f /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  OS_ID="${ID:-unknown}"
else
  OS_ID="unknown"
fi

echo "==> Installing system packages ($OS_ID)"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y --no-install-recommends \
    ca-certificates curl git nginx ufw fail2ban \
    build-essential python3 unzip tar gzip \
    redis-server
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y curl git nginx firewalld fail2ban \
    gcc-c++ make python3 unzip tar gzip redis
  systemctl enable --now redis || systemctl enable --now redis-server || true
else
  echo "Unsupported package manager" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]; then
  echo "==> Installing Node.js 22 LTS"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y nodejs
  else
    echo "Install Node 22 manually for this distro" >&2
    exit 1
  fi
fi

echo "==> Installing PM2"
npm install -g pm2

echo "==> Creating app user and folders"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR" "$LOG_DIR" "$APP_ROOT/run"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
chmod 750 "$APP_ROOT" "$DATA_DIR"

echo "==> Firewall (HTTP + SSH only)"
if command -v ufw >/dev/null 2>&1; then
  ufw --force reset || true
  ufw default deny incoming
  ufw default allow outgoing
  # Keep current SSH port reachable
  SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
  SSH_PORT="${SSH_PORT:-22}"
  ufw allow "${SSH_PORT}/tcp" comment 'SSH'
  ufw allow 80/tcp comment 'HTTP'
  ufw --force enable
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable --now redis-server 2>/dev/null || systemctl enable --now redis 2>/dev/null || true
  systemctl enable --now nginx
  systemctl enable --now fail2ban 2>/dev/null || true
fi

echo "==> Cloning / updating repository"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth=1 origin main
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "$APP_DIR"
  sudo -u "$APP_USER" git clone --depth=1 "$REPO_URL" "$APP_DIR"
fi

# Exclude heavy reference sources from runtime tree if present (keep code smaller)
if [ -d "$APP_DIR/sources" ]; then
  echo "==> Removing reference sources/ from runtime deploy"
  rm -rf "$APP_DIR/sources"
fi

ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> Writing production .env"
  ACCESS_SECRET="$(openssl rand -hex 32)"
  REFRESH_SECRET="$(openssl rand -hex 32)"
  BOT_KEY="$(openssl rand -hex 24)"
  BANK_KEY="$(openssl rand -hex 32)"
  OWNER_PASS="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)Aa1"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=${API_PORT}
DATABASE_URL="file:./prod.db"
REDIS_URL=redis://127.0.0.1:6379
CORS_ORIGINS=http://${PUBLIC_HOST},http://${PUBLIC_HOST}:${PUBLIC_PORT}
JWT_ACCESS_SECRET=${ACCESS_SECRET}
JWT_REFRESH_SECRET=${REFRESH_SECRET}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BANK_DATA_ENCRYPTION_KEY=${BANK_KEY}
BOT_INTERNAL_API_KEY=${BOT_KEY}
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
SEED_OWNER_USERNAME=owner
SEED_OWNER_PASSWORD=${OWNER_PASS}
SEED_OWNER_EMAIL=owner@${PUBLIC_HOST}
AUDIT_RETENTION_DAYS=90
AUDIT_MAX_ROWS=100000
AUDIT_PURGE_INTERVAL_HOURS=24
NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "$OWNER_PASS" > "$APP_ROOT/CREDENTIALS.txt"
  chmod 600 "$APP_ROOT/CREDENTIALS.txt"
  chown root:root "$APP_ROOT/CREDENTIALS.txt"
  echo "Owner password saved to ${APP_ROOT}/CREDENTIALS.txt"
else
  echo "==> Keeping existing .env"
fi

echo "==> Installing npm deps (root + apps)"
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --omit=dev
sudo -u "$APP_USER" npm install --prefix apps/api
sudo -u "$APP_USER" npm install --prefix apps/dashboard
sudo -u "$APP_USER" npm install --prefix apps/bot --no-fund --no-audit || true

echo "==> Prisma generate + db push + seed"
sudo -u "$APP_USER" npx prisma generate --schema prisma/schema.prisma
sudo -u "$APP_USER" npx prisma db push --schema prisma/schema.prisma --accept-data-loss
# Seed once if DB empty-ish
if [ ! -f "$DATA_DIR/.seeded" ]; then
  sudo -u "$APP_USER" npm run db:seed --prefix apps/api || sudo -u "$APP_USER" npx tsx apps/api/src/db/seed.ts || true
  touch "$DATA_DIR/.seeded"
  chown "$APP_USER:$APP_USER" "$DATA_DIR/.seeded"
fi

# Keep SQLite under data volume
if [ -f "$APP_DIR/prisma/prod.db" ]; then
  mv -f "$APP_DIR/prisma/prod.db" "$DATA_DIR/prod.db" || true
fi
# Point DATABASE_URL to absolute data path
if grep -q 'file:./prod.db' "$ENV_FILE"; then
  sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"file:${DATA_DIR}/prod.db\"|" "$ENV_FILE"
fi
# Ensure db exists at data path
if [ ! -f "$DATA_DIR/prod.db" ]; then
  sudo -u "$APP_USER" DATABASE_URL="file:${DATA_DIR}/prod.db" npx prisma db push --schema prisma/schema.prisma --accept-data-loss
  sudo -u "$APP_USER" DATABASE_URL="file:${DATA_DIR}/prod.db" npm run db:seed --prefix apps/api || true
fi
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

echo "==> Building API + Dashboard"
sudo -u "$APP_USER" npm run build --prefix apps/api || true
# Prefer running API with tsx if tsc build fails (pre-existing TS issues)
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/dashboard' && NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1 npm run build"

echo "==> PM2 ecosystem"
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
        DOTENV_CONFIG_PATH: '${APP_DIR}/.env',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      out_file: '${LOG_DIR}/api.out.log',
      error_file: '${LOG_DIR}/api.err.log',
      time: true,
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
        NUXT_PUBLIC_API_BASE: 'http://${PUBLIC_HOST}/api/v1',
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: '${WEB_PORT}',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '450M',
      out_file: '${LOG_DIR}/web.out.log',
      error_file: '${LOG_DIR}/web.err.log',
      time: true,
    },
  ],
};
EOF
chown "$APP_USER:$APP_USER" "$APP_ROOT/ecosystem.config.cjs"

# Load env into API process via dotenv already reading root .env
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && pm2 delete crm-api crm-web 2>/dev/null || true"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && pm2 start '$APP_ROOT/ecosystem.config.cjs'"
sudo -u "$APP_USER" pm2 save
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -n 1 | bash || true

echo "==> Nginx reverse proxy (HTTP only)"
cat > /etc/nginx/sites-available/crm <<EOF
limit_req_zone \$binary_remote_addr zone=crm_api:10m rate=10r/s;

server {
    listen ${PUBLIC_PORT} default_server;
    listen [::]:${PUBLIC_PORT} default_server;
    server_name ${PUBLIC_HOST} _;

    client_max_body_size 20m;
    server_tokens off;

    # Security headers (no HSTS — HTTP only as requested)
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # API — only localhost upstream
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
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Dashboard (Nuxt SPA/Nitro)
    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ~* /\.(env|git|npmrc|pnpmrc) {
        deny all;
        return 404;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Ensuring admin user 'saman'"
SAMAN_PASS_FILE="$APP_ROOT/ADMIN_SAMAN.txt"
# Prefer explicit env, then existing file, then stable default for first bootstrap
if [ -n "${ADMIN_SAMAN_PASSWORD:-}" ]; then
  SAMAN_PASS="$ADMIN_SAMAN_PASSWORD"
elif [ -f "$SAMAN_PASS_FILE" ]; then
  SAMAN_PASS="$(tr -d '\r\n' < "$SAMAN_PASS_FILE")"
else
  SAMAN_PASS="Saman@Crm2026!"
fi
printf '%s\n' "$SAMAN_PASS" > "$SAMAN_PASS_FILE"
chmod 600 "$SAMAN_PASS_FILE"
chown root:root "$SAMAN_PASS_FILE"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && DATABASE_URL=\"file:${DATA_DIR}/prod.db\" node scripts/create-admin-user.mjs saman '$SAMAN_PASS' سامان ادمین" \
  || sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && DATABASE_URL=\"file:${DATA_DIR}/prod.db\" node apps/api/scripts/create-admin-user.mjs saman '$SAMAN_PASS' سامان ادمین" \
  || echo "WARN: could not create saman admin (seed/scripts missing?)"

echo "==> Post-install harden & cleanup"
if [ -f "$APP_DIR/deploy/harden-cleanup.sh" ]; then
  bash "$APP_DIR/deploy/harden-cleanup.sh" || true
elif [ -f /tmp/crm-harden.sh ]; then
  bash /tmp/crm-harden.sh || true
fi

echo "==> Done"
echo "URL: http://${PUBLIC_HOST}/"
if [ -f "$APP_ROOT/CREDENTIALS.txt" ]; then
  echo "Owner password file: $APP_ROOT/CREDENTIALS.txt"
  echo -n "owner / "
  cat "$APP_ROOT/CREDENTIALS.txt"
  echo
fi
if [ -f "$SAMAN_PASS_FILE" ]; then
  echo "Admin saman password file: $SAMAN_PASS_FILE"
  echo -n "saman / "
  cat "$SAMAN_PASS_FILE"
  echo
fi
pm2 status || sudo -u "$APP_USER" pm2 status
