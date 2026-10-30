#!/usr/bin/env python3
"""
Deploy CRM to Iranian VPS when raw.githubusercontent/npm/ubuntu mirrors are flaky.
- git clone from github.com (works)
- install Node from GitHub node release asset or unofficial build
- build on server with swap, or use uploaded build
"""
from __future__ import annotations

import io
import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

HOST = "87.107.54.193"
PORT = 9011
USER = "root"
PASSWORD = "JFbkq4img1"
ROOT = Path(__file__).resolve().parents[1]
PUBLIC_HOST = "87.107.54.193"


def connect() -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    return c


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 1200) -> int:
    print(f"\n===== CMD =====\n{cmd[:300]}\n===============", flush=True)
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout, get_pty=True)
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            sys.stdout.write(stdout.channel.recv(4096).decode("utf-8", "replace"))
            sys.stdout.flush()
        if stderr.channel.recv_stderr_ready():
            sys.stdout.write(stderr.channel.recv_stderr(4096).decode("utf-8", "replace"))
            sys.stdout.flush()
        time.sleep(0.05)
    while stdout.channel.recv_ready():
        sys.stdout.write(stdout.channel.recv(4096).decode("utf-8", "replace"))
        sys.stdout.flush()
    code = stdout.channel.recv_exit_status()
    print(f"\n[exit {code}]", flush=True)
    return code


def upload_text(sftp: paramiko.SFTPClient, remote: str, content: str) -> None:
    with sftp.file(remote, "w") as f:
        f.write(content.replace("\r\n", "\n"))


def main() -> int:
    c = connect()
    print("SSH OK")

    # 1) swap for Nuxt build on 1GB RAM
    run(
        c,
        r"""
set -e
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
swapon --show || true
free -m | head -2
""",
        timeout=120,
    )

    # 2) try apt with longer timeout / alternate mirror
    run(
        c,
        r"""
set +e
export DEBIAN_FRONTEND=noninteractive
# Prefer a reachable mirror if archive is blocked
sed -i 's|http://archive.ubuntu.com/ubuntu|http://mirror.iranserver.com/ubuntu|g' /etc/apt/sources.list 2>/dev/null
sed -i 's|http://security.ubuntu.com/ubuntu|http://mirror.iranserver.com/ubuntu|g' /etc/apt/sources.list 2>/dev/null
# also try ariagostar / hostiran commonly used
apt-get update -y 2>&1 | tail -20
apt-get install -y --no-install-recommends ca-certificates curl git nginx ufw fail2ban build-essential python3 redis-server xz-utils 2>&1 | tail -40
which nginx git curl
systemctl enable --now nginx 2>/dev/null
systemctl enable --now redis-server 2>/dev/null || systemctl enable --now redis 2>/dev/null || true
""",
        timeout=600,
    )

    # 3) Install Node 22 binary from nodejs.org OR github mirror
    run(
        c,
        r"""
set -e
if command -v node >/dev/null 2>&1 && [ "$(node -v | sed 's/v//' | cut -d. -f1)" -ge 20 ]; then
  echo "node already $(node -v)"
  exit 0
fi
cd /tmp
VER=v22.14.0
FILE=node-${VER}-linux-x64.tar.xz
rm -f "$FILE"
# try multiple CDNs
ok=0
for url in \
  "https://nodejs.org/dist/${VER}/${FILE}" \
  "https://npmmirror.com/mirrors/node/${VER}/${FILE}" \
  "https://unofficial-builds.nodejs.org/download/release/${VER}/${FILE}"
 do
  echo "TRY $url"
  if curl -fL --connect-timeout 20 --max-time 300 -o "$FILE" "$url"; then
    ok=1; break
  fi
done
if [ "$ok" != 1 ]; then
  echo "FAILED download node"; exit 1
fi
tar -xJf "$FILE" -C /usr/local --strip-components=1
node -v
npm -v
npm install -g pm2
pm2 -v
""",
        timeout=900,
    )

    # 4) Clone repo via git (github.com works)
    run(
        c,
        r"""
set -e
APP_USER=crm
APP_ROOT=/opt/crm
APP_DIR=$APP_ROOT/app
id -u $APP_USER >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash $APP_USER
mkdir -p $APP_ROOT/data $APP_ROOT/logs $APP_ROOT/run
if [ -d $APP_DIR/.git ]; then
  sudo -u $APP_USER git -C $APP_DIR fetch --depth=1 origin main
  sudo -u $APP_USER git -C $APP_DIR reset --hard origin/main
else
  rm -rf $APP_DIR
  sudo -u $APP_USER git clone --depth=1 https://github.com/saman-alayee/crm_app.git $APP_DIR
fi
rm -rf $APP_DIR/sources
chown -R $APP_USER:$APP_USER $APP_ROOT
ls -la $APP_DIR | head
""",
        timeout=300,
    )

    # Upload fix-stack via SFTP as backup if clone incomplete, then run adapted remote install
    sftp = c.open_sftp()
    remote_script = "/tmp/crm-remote-install.sh"
    local_script = ROOT / "deploy" / "fix-stack.sh"
    # Upload fix-stack but we'll run a tailored install below
    upload_text(sftp, "/tmp/crm-fix-stack.sh", local_script.read_text(encoding="utf-8"))
    sftp.close()

    # 5) Run install using already-cloned tree (skip curl raw github)
    code = run(
        c,
        rf"""
set -e
export DEBIAN_FRONTEND=noninteractive
export PUBLIC_HOST={PUBLIC_HOST}
export ADMIN_SAMAN_PASSWORD='Saman@Crm2026!'
export REPO_URL=https://github.com/saman-alayee/crm_app.git

# If fix-stack exists locally in repo, prefer that
if [ -f /opt/crm/app/deploy/fix-stack.sh ]; then
  # Patch: don't curl raw.githubusercontent; code already present
  sed 's|curl -fsSL https://raw.githubusercontent.com/.*fix-stack.sh.*||' /opt/crm/app/deploy/fix-stack.sh > /tmp/crm-fix-run.sh || cp /opt/crm/app/deploy/fix-stack.sh /tmp/crm-fix-run.sh
fi

# Inline install (robust)
APP_USER=crm
APP_ROOT=/opt/crm
APP_DIR=$APP_ROOT/app
DATA_DIR=$APP_ROOT/data
LOG_DIR=$APP_ROOT/logs
API_PORT=4000
WEB_PORT=3000
PUBLIC_HOST={PUBLIC_HOST}

# ensure node
node -v
npm -v
npm install -g pm2

ENV_FILE=$APP_DIR/.env
if [ ! -f "$ENV_FILE" ]; then
  ACCESS_SECRET=$(openssl rand -hex 32)
  REFRESH_SECRET=$(openssl rand -hex 32)
  BOT_KEY=$(openssl rand -hex 24)
  BANK_KEY=$(openssl rand -hex 32)
  OWNER_PASS=$(openssl rand -base64 14 | tr -d '/+=' | cut -c1-12)Aa1
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=${{API_PORT}}
DATABASE_URL="file:${{DATA_DIR}}/prod.db"
REDIS_URL=redis://127.0.0.1:6379
CORS_ORIGINS=http://${{PUBLIC_HOST}},http://${{PUBLIC_HOST}}:80,http://127.0.0.1
JWT_ACCESS_SECRET=${{ACCESS_SECRET}}
JWT_REFRESH_SECRET=${{REFRESH_SECRET}}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BANK_DATA_ENCRYPTION_KEY=${{BANK_KEY}}
BOT_INTERNAL_API_KEY=${{BOT_KEY}}
TELEGRAM_BOT_TOKEN=
SEED_OWNER_USERNAME=owner
SEED_OWNER_PASSWORD=${{OWNER_PASS}}
SEED_OWNER_EMAIL=owner@${{PUBLIC_HOST}}
AUDIT_RETENTION_DAYS=90
NUXT_PUBLIC_API_BASE=http://${{PUBLIC_HOST}}/api/v1
EOF
  echo "$OWNER_PASS" > $APP_ROOT/CREDENTIALS.txt
  chmod 600 $APP_ROOT/CREDENTIALS.txt
else
  sed -i "s|^HOST=.*|HOST=127.0.0.1|" "$ENV_FILE" || true
  grep -q '^HOST=' "$ENV_FILE" || echo 'HOST=127.0.0.1' >> "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:${{DATA_DIR}}/prod.db\"|" "$ENV_FILE"
  sed -i "s|^NUXT_PUBLIC_API_BASE=.*|NUXT_PUBLIC_API_BASE=http://${{PUBLIC_HOST}}/api/v1|" "$ENV_FILE" || echo "NUXT_PUBLIC_API_BASE=http://${{PUBLIC_HOST}}/api/v1" >> "$ENV_FILE"
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://${{PUBLIC_HOST}},http://${{PUBLIC_HOST}}:80,http://127.0.0.1|" "$ENV_FILE"
fi
chown crm:crm "$ENV_FILE"
chmod 600 "$ENV_FILE"

cd "$APP_DIR"
# npm registry mirrors if official is slow
npm config set fetch-retries 5
npm config set fetch-retry-maxtimeout 120000
npm config set fetch-timeout 300000
# try npmmirror if needed
sudo -u crm npm install --omit=dev --registry=https://registry.npmmirror.com || sudo -u crm npm install --omit=dev
sudo -u crm npm install --prefix apps/api --registry=https://registry.npmmirror.com || sudo -u crm npm install --prefix apps/api
sudo -u crm npm install --prefix apps/dashboard --registry=https://registry.npmmirror.com || sudo -u crm npm install --prefix apps/dashboard

sudo -u crm npx prisma generate --schema prisma/schema.prisma
sudo -u crm DATABASE_URL="file:${{DATA_DIR}}/prod.db" npx prisma db push --schema prisma/schema.prisma --accept-data-loss
if [ ! -f "$DATA_DIR/.seeded" ]; then
  sudo -u crm bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && npm run db:seed --prefix apps/api" || true
  touch "$DATA_DIR/.seeded"
  chown crm:crm "$DATA_DIR/.seeded"
fi
chown -R crm:crm "$DATA_DIR"

echo 'Building dashboard...'
sudo -u crm bash -lc "cd '$APP_DIR/apps/dashboard' && NODE_OPTIONS=--max-old-space-size=768 NUXT_PUBLIC_API_BASE=http://${{PUBLIC_HOST}}/api/v1 npm run build"
test -f "$APP_DIR/apps/dashboard/.output/server/index.mjs"

# admin saman
printf '%s\n' "$ADMIN_SAMAN_PASSWORD" > $APP_ROOT/ADMIN_SAMAN.txt
chmod 600 $APP_ROOT/ADMIN_SAMAN.txt
sudo -u crm bash -lc "cd '$APP_DIR/apps/api' && DATABASE_URL=\"file:${{DATA_DIR}}/prod.db\" node scripts/create-admin-user.mjs saman '$ADMIN_SAMAN_PASSWORD' سامان ادمین" || true

cat > $APP_ROOT/ecosystem.config.cjs <<EOF
module.exports = {{
  apps: [
    {{
      name: 'crm-api',
      cwd: '{APP_DIR}/apps/api',
      script: 'npx',
      args: 'tsx src/index.ts',
      interpreter: 'none',
      env: {{ NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '{API_PORT}', DOTENV_CONFIG_PATH: '{APP_DIR}/.env' }},
      instances: 1, autorestart: true, max_memory_restart: '350M',
      out_file: '{LOG_DIR}/api.out.log', error_file: '{LOG_DIR}/api.err.log', time: true, merge_logs: true,
    }},
    {{
      name: 'crm-web',
      cwd: '{APP_DIR}/apps/dashboard',
      script: 'node',
      args: '.output/server/index.mjs',
      env: {{ NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '{WEB_PORT}', NITRO_HOST: '127.0.0.1', NITRO_PORT: '{WEB_PORT}', NUXT_PUBLIC_API_BASE: 'http://{PUBLIC_HOST}/api/v1' }},
      instances: 1, autorestart: true, max_memory_restart: '350M',
      out_file: '{LOG_DIR}/web.out.log', error_file: '{LOG_DIR}/web.err.log', time: true, merge_logs: true,
    }},
  ],
}};
EOF
# fix placeholders
sed -i "s|{{APP_DIR}}|$APP_DIR|g; s|{{API_PORT}}|$API_PORT|g; s|{{WEB_PORT}}|$WEB_PORT|g; s|{{LOG_DIR}}|$LOG_DIR|g; s|{{PUBLIC_HOST}}|$PUBLIC_HOST|g" $APP_ROOT/ecosystem.config.cjs
# The heredoc already expanded via python - rewrite cleanly:
cat > $APP_ROOT/ecosystem.config.cjs <<'EOF'
module.exports = {
  apps: [
    {
      name: 'crm-api',
      cwd: '/opt/crm/app/apps/api',
      script: 'npx',
      args: 'tsx src/index.ts',
      interpreter: 'none',
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '4000', DOTENV_CONFIG_PATH: '/opt/crm/app/.env' },
      instances: 1, autorestart: true, max_memory_restart: '350M',
      out_file: '/opt/crm/logs/api.out.log', error_file: '/opt/crm/logs/api.err.log', time: true, merge_logs: true,
    },
    {
      name: 'crm-web',
      cwd: '/opt/crm/app/apps/dashboard',
      script: 'node',
      args: '.output/server/index.mjs',
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '3000', NITRO_HOST: '127.0.0.1', NITRO_PORT: '3000', NUXT_PUBLIC_API_BASE: 'http://87.107.54.193/api/v1' },
      instances: 1, autorestart: true, max_memory_restart: '350M',
      out_file: '/opt/crm/logs/web.out.log', error_file: '/opt/crm/logs/web.err.log', time: true, merge_logs: true,
    },
  ],
};
EOF
chown crm:crm $APP_ROOT/ecosystem.config.cjs

sudo -u crm bash -lc "cd /opt/crm/app && set -a && . ./.env && set +a && pm2 delete crm-api crm-web 2>/dev/null || true; pm2 start /opt/crm/ecosystem.config.cjs; pm2 save"
env PATH=$PATH pm2 startup systemd -u crm --hp /home/crm 2>/dev/null | tail -n 1 | bash || true

# nginx
cat > /etc/nginx/sites-available/crm <<'EOF'
limit_req_zone $binary_remote_addr zone=crm_api:10m rate=10r/s;
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 87.107.54.193 _;
    client_max_body_size 10m;
    server_tokens off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    location /api/ {
        limit_req zone=crm_api burst=30 nodelay;
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# firewall
SSH_PORT=$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')
SSH_PORT=${{SSH_PORT:-9011}}
ufw allow ${{SSH_PORT}}/tcp || true
ufw allow 80/tcp || true
ufw --force enable || true

sleep 3
echo '=== VERIFY ==='
sudo -u crm pm2 status
ss -lntp | grep -E ':(80|3000|4000) ' || true
curl -fsS --max-time 5 http://127.0.0.1:4000/api/v1/health; echo
curl -fsS -o /dev/null -w 'web=%{http_code}\n' --max-time 5 http://127.0.0.1:3000/
curl -fsS -o /dev/null -w 'proxy=%{http_code}\n' --max-time 5 http://127.0.0.1/
echo -n 'saman: '; cat /opt/crm/ADMIN_SAMAN.txt; echo
echo -n 'owner: '; cat /opt/crm/CREDENTIALS.txt; echo
""",
        timeout=3600,
    )

    c.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
