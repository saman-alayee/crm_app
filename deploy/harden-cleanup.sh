#!/usr/bin/env bash
# Cleanup unused files + harden/optimize CRM VPS.
# Run as root: bash harden-cleanup.sh
set -euo pipefail

APP_USER="crm"
APP_ROOT="/opt/crm"
APP_DIR="${APP_ROOT}/app"
DATA_DIR="${APP_ROOT}/data"
LOG_DIR="${APP_ROOT}/logs"
PUBLIC_HOST="${PUBLIC_HOST:-87.107.54.193}"
API_PORT=4000
WEB_PORT=3000

echo "==> CRM harden & cleanup on $(hostname)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root" >&2
  exit 1
fi

# ── 1) Remove dead weight from app tree ─────────────────────
if [ -d "$APP_DIR" ]; then
  echo "==> Removing unused / heavy paths"
  rm -rf \
    "$APP_DIR/sources" \
    "$APP_DIR/.turbo" \
    "$APP_DIR/.cache" \
    "$APP_DIR/apps/dashboard/.nuxt" \
    "$APP_DIR/apps/dashboard/.output/cache" \
    "$APP_DIR/apps/dashboard/node_modules/.cache" \
    "$APP_DIR/apps/api/node_modules/.cache" \
    "$APP_DIR/node_modules/.cache" \
    /tmp/crm_app /tmp/crm-setup.sh
  rm -f \
    "$APP_DIR/apps/api/scripts/qa-smoke.mjs" \
    "$APP_DIR/apps/api/scripts/qa-report.json" \
    "$APP_DIR/apps/api/scripts/reset-owner-qa.mjs" \
    "$APP_DIR/apps/api/scripts/restore-owner-password.mjs" \
    "$APP_DIR/apps/api/scripts/seed-qa-users.mjs" \
    "$APP_DIR/scripts/seed-qa-users.mjs" \
    /tmp/crm_* 2>/dev/null || true

  # Dev-only leftovers
  find "$APP_DIR" -type d \( -name '__tests__' -o -name 'coverage' \) -prune -exec rm -rf {} + 2>/dev/null || true
  find "$APP_DIR" -type f \( -name '*.log' -o -name 'npm-debug.log*' -o -name '.DS_Store' \) -delete 2>/dev/null || true
  find "$APP_DIR" -type f -name '*.map' ! -path '*/.output/*' -delete 2>/dev/null || true

  # Keep shallow git history only (for pull updates)
  if [ -d "$APP_DIR/.git" ]; then
    sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth=1 origin main 2>/dev/null || true
    sudo -u "$APP_USER" git -C "$APP_DIR" gc --prune=now --aggressive 2>/dev/null || true
  fi
fi

# Old clone leftovers outside /opt/crm
rm -rf /root/crm_app /root/Crm* /var/tmp/crm_* /tmp/crm_app /tmp/crm-setup.sh 2>/dev/null || true

# ── 2) Permissions & secrets ───────────────────────────────
echo "==> Hardening permissions"
mkdir -p "$DATA_DIR" "$LOG_DIR" "$APP_ROOT/run"
chown -R "$APP_USER:$APP_USER" "$APP_ROOT"
chmod 750 "$APP_ROOT" "$DATA_DIR" "$LOG_DIR"
chmod 750 "$APP_DIR" 2>/dev/null || true

if [ -f "$APP_DIR/.env" ]; then
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi
for f in "$APP_ROOT/CREDENTIALS.txt" "$APP_ROOT/ADMIN_SAMAN.txt"; do
  if [ -f "$f" ]; then
    chown root:root "$f"
    chmod 600 "$f"
  fi
done

# Block web access to sensitive paths if nginx serves static by mistake
if [ -d "$APP_DIR" ]; then
  find "$APP_DIR" -type f \( -name '.env' -o -name '*.pem' -o -name '*.key' \) -exec chmod 600 {} \; 2>/dev/null || true
fi

# Ensure SQLite is not world-readable
if [ -f "$DATA_DIR/prod.db" ]; then
  chown "$APP_USER:$APP_USER" "$DATA_DIR/prod.db"*
  chmod 640 "$DATA_DIR/prod.db"*
fi

# ── 3) Bind services to localhost only ─────────────────────
echo "==> Ensuring API/Web listen on 127.0.0.1 only"
if [ -f "$APP_DIR/.env" ]; then
  grep -q '^HOST=' "$APP_DIR/.env" && sed -i 's/^HOST=.*/HOST=127.0.0.1/' "$APP_DIR/.env" || echo 'HOST=127.0.0.1' >> "$APP_DIR/.env"
  grep -q '^NODE_ENV=' "$APP_DIR/.env" && sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "$APP_DIR/.env" || echo 'NODE_ENV=production' >> "$APP_DIR/.env"
fi

# Patch PM2 ecosystem if present
ECO="$APP_ROOT/ecosystem.config.cjs"
if [ -f "$ECO" ]; then
  # Recreate with hardened binds
  cat > "$ECO" <<EOF
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
  chown "$APP_USER:$APP_USER" "$ECO"
fi

# ── 4) Firewall ────────────────────────────────────────────
echo "==> Firewall (SSH + HTTP only)"
if command -v ufw >/dev/null 2>&1; then
  SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
  SSH_PORT="${SSH_PORT:-22}"
  ufw --force reset || true
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow "${SSH_PORT}/tcp" comment 'SSH'
  ufw allow 80/tcp comment 'HTTP'
  # Explicitly deny app ports from outside (defense in depth)
  ufw deny ${API_PORT}/tcp comment 'block API public'
  ufw deny ${WEB_PORT}/tcp comment 'block Nuxt public'
  ufw --force enable
  ufw status verbose || true
fi

# ── 5) fail2ban ────────────────────────────────────────────
echo "==> fail2ban"
if command -v apt-get >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends fail2ban >/dev/null 2>&1 || true
fi
mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/crm-sshd.conf <<'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban 2>/dev/null || true
systemctl restart fail2ban 2>/dev/null || true

# ── 6) Nginx security headers + rate limit ─────────────────
echo "==> Nginx hardening"
if [ -d /etc/nginx ]; then
  cat > /etc/nginx/sites-available/crm <<EOF
limit_req_zone \$binary_remote_addr zone=crm_api:10m rate=10r/s;
limit_conn_zone \$binary_remote_addr zone=crm_conn:10m;

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PUBLIC_HOST} _;

    client_max_body_size 10m;
    server_tokens off;
    limit_conn crm_conn 40;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header X-XSS-Protection "0" always;

    location /api/ {
        limit_req zone=crm_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_hide_header X-Powered-By;
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

    location / {
        proxy_pass http://127.0.0.1:${WEB_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_hide_header X-Powered-By;
    }

    location ~* /\.(env|git|npmrc|pnpmrc|DS_Store) {
        deny all;
        return 404;
    }

    location ~* /(CREDENTIALS|ADMIN_SAMAN)\.txt\$ {
        deny all;
        return 404;
    }
}
EOF
  ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
fi

# ── 7) Logrotate + disk hygiene ────────────────────────────
echo "==> Logrotate + prune logs"
cat > /etc/logrotate.d/crm <<EOF
${LOG_DIR}/*.log {
  weekly
  rotate 8
  missingok
  notifempty
  compress
  delaycompress
  copytruncate
  su ${APP_USER} ${APP_USER}
}
EOF

# Truncate huge logs (>50MB)
find "$LOG_DIR" -type f -name '*.log' -size +50M -exec truncate -s 0 {} \; 2>/dev/null || true
journalctl --vacuum-size=200M 2>/dev/null || true

# ── 8) npm / apt cleanup ───────────────────────────────────
echo "==> Package cache cleanup"
if [ -d "$APP_DIR" ]; then
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm cache clean --force" 2>/dev/null || true
fi
npm cache clean --force 2>/dev/null || true
if command -v apt-get >/dev/null 2>&1; then
  apt-get autoremove -y >/dev/null 2>&1 || true
  apt-get clean >/dev/null 2>&1 || true
fi

# ── 9) Restart stack if present ────────────────────────────
if id "$APP_USER" >/dev/null 2>&1 && [ -f "$ECO" ]; then
  echo "==> Restarting PM2 apps"
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && set -a && [ -f .env ] && . ./.env; set +a; pm2 delete crm-api crm-web 2>/dev/null || true; pm2 start '$ECO'; pm2 save" || true
  env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null | tail -n 1 | bash || true
fi

# ── 10) Quick security audit printout ──────────────────────
echo ""
echo "======== STATUS ========"
echo "Disk:"
df -h / | tail -1
echo "App size:"
du -sh "$APP_ROOT" 2>/dev/null || true
du -sh "$APP_DIR/sources" 2>/dev/null && echo "WARN: sources/ still present" || echo "OK: no sources/"
echo "Listening (should be 80 public; 3000/4000 localhost only):"
ss -lntp 2>/dev/null | grep -E ':(80|3000|4000|9011|22)\s' || netstat -lntp 2>/dev/null | grep -E ':(80|3000|4000)' || true
echo "UFW:"
ufw status 2>/dev/null | head -20 || true
echo "PM2:"
sudo -u "$APP_USER" pm2 status 2>/dev/null || pm2 status 2>/dev/null || true
echo "Health:"
curl -fsS --max-time 5 http://127.0.0.1:${API_PORT}/api/v1/health || echo "API not up yet"
echo ""
echo "Done. Panel: http://${PUBLIC_HOST}/"
