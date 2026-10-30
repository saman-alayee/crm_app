#!/usr/bin/env bash
set -euo pipefail
export NO_PROXY=127.0.0.1,localhost

PUBLIC_HOST="${PUBLIC_HOST:-87.107.54.193}"
ADMIN_SAMAN_PASSWORD="${ADMIN_SAMAN_PASSWORD:-Saman@Crm2026!}"
APP_USER=crm
APP_ROOT=/opt/crm
APP_DIR=$APP_ROOT/app
DATA_DIR=$APP_ROOT/data
LOG_DIR=$APP_ROOT/logs

echo "==> node"
tar -xJf /tmp/node-v22.14.0-linux-x64.tar.xz -C /usr/local --strip-components=1
hash -r
node -v
npm -v

echo "==> extract"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$APP_USER"
mkdir -p "$DATA_DIR" "$LOG_DIR" "$APP_ROOT/run"
[ -f "$APP_DIR/.env" ] && cp "$APP_DIR/.env" /tmp/crm.env.bak || true
rm -rf "$APP_DIR"
mkdir -p "$APP_ROOT"
tar -xzf /tmp/crm-fast.tgz -C "$APP_ROOT"
[ -f /tmp/crm.env.bak ] && cp /tmp/crm.env.bak "$APP_DIR/.env" || true
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
test -f "$APP_DIR/apps/dashboard/.output/server/index.mjs"
test -d "$APP_DIR/apps/api/node_modules"

ENV_FILE=$APP_DIR/.env
if [ ! -f "$ENV_FILE" ]; then
  OWNER_PASS=$(openssl rand -base64 14 | tr -d '/+=' | cut -c1-12)Aa1
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL="file:${DATA_DIR}/prod.db"
REDIS_URL=redis://127.0.0.1:6379
CORS_ORIGINS=http://${PUBLIC_HOST},http://${PUBLIC_HOST}:80,http://127.0.0.1
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BANK_DATA_ENCRYPTION_KEY=$(openssl rand -hex 32)
BOT_INTERNAL_API_KEY=$(openssl rand -hex 24)
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

echo "==> prisma"
cd "$APP_DIR"
# Prefer bundled client; regenerate if proxy available
if [ -n "${http_proxy:-}" ]; then
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npx prisma generate --schema prisma/schema.prisma" || true
fi
if [ ! -f "$DATA_DIR/prod.db" ]; then
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && DATABASE_URL=\"file:$DATA_DIR/prod.db\" npx prisma db push --schema prisma/schema.prisma --accept-data-loss" || true
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && npm run db:seed --prefix apps/api" || true
fi
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"

echo "==> admin saman"
printf '%s\n' "$ADMIN_SAMAN_PASSWORD" > "$APP_ROOT/ADMIN_SAMAN.txt"
chmod 600 "$APP_ROOT/ADMIN_SAMAN.txt"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/apps/api' && DATABASE_URL=\"file:$DATA_DIR/prod.db\" node scripts/create-admin-user.mjs saman '$ADMIN_SAMAN_PASSWORD' saman admin" || true

systemctl enable --now redis-server 2>/dev/null || systemctl enable --now redis 2>/dev/null || true

echo "==> systemd units"
# stop old pm2 if any
sudo -u "$APP_USER" pm2 delete all 2>/dev/null || true
sudo -u "$APP_USER" pm2 kill 2>/dev/null || true

cat > /etc/systemd/system/crm-api.service <<EOF
[Unit]
Description=CRM API
After=network.target redis-server.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/api
EnvironmentFile=${APP_DIR}/.env
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=4000
Environment=DOTENV_CONFIG_PATH=${APP_DIR}/.env
ExecStart=/usr/local/bin/npx tsx src/index.ts
Restart=always
RestartSec=3
MemoryMax=400M
StandardOutput=append:${LOG_DIR}/api.out.log
StandardError=append:${LOG_DIR}/api.err.log

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/crm-web.service <<EOF
[Unit]
Description=CRM Dashboard
After=network.target crm-api.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/apps/dashboard
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=NITRO_HOST=127.0.0.1
Environment=NITRO_PORT=3000
Environment=NUXT_PUBLIC_API_BASE=http://${PUBLIC_HOST}/api/v1
ExecStart=/usr/local/bin/node .output/server/index.mjs
Restart=always
RestartSec=3
MemoryMax=400M
StandardOutput=append:${LOG_DIR}/web.out.log
StandardError=append:${LOG_DIR}/web.err.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable crm-api crm-web
systemctl restart crm-api crm-web

echo "==> nginx"
cat > /etc/nginx/sites-available/crm <<'NGX'
limit_req_zone $binary_remote_addr zone=crm_api:10m rate=10r/s;
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 87.107.54.193 _;
    client_max_body_size 10m;
    server_tokens off;
    location /api/ {
        limit_req zone=crm_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGX
ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ufw allow 80/tcp || true
ufw allow 9011/tcp || true
ufw --force enable || true

sleep 6
echo "==> VERIFY"
systemctl --no-pager --full status crm-api crm-web | sed -n '1,40p' || true
ss -lntp | grep -E ':(80|3000|4000) ' || true
curl -fsS --max-time 8 http://127.0.0.1:4000/api/v1/health || echo API_FAIL
echo
curl -fsS -o /dev/null -w 'web=%{http_code}\n' --max-time 8 http://127.0.0.1:3000/ || echo WEB_FAIL
curl -fsS -o /dev/null -w 'proxy=%{http_code}\n' --max-time 8 http://127.0.0.1/ || echo PROXY_FAIL
echo -n 'saman / '; cat "$APP_ROOT/ADMIN_SAMAN.txt"; echo
echo -n 'owner / '; cat "$APP_ROOT/CREDENTIALS.txt" 2>/dev/null; echo
echo "URL: http://${PUBLIC_HOST}/"
