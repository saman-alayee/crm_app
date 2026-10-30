#!/usr/bin/env python3
"""Offline-ish CRM deploy: SFTP Node + app (built dashboard + node_modules), nginx/pm2."""
from __future__ import annotations

import os
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

HOST = "87.107.54.193"
PORT = 9011
USER = "root"
PASSWORD = "JFbkq4img1"
PUBLIC_HOST = "87.107.54.193"
ADMIN_PASS = "Saman@Crm2026!"
ROOT = Path(__file__).resolve().parents[1]
NODE_TAR = Path(__file__).resolve().parent / "_node_cache" / "node-v22.14.0-linux-x64.tar.xz"

SKIP_TOP = {".git", "sources", "agent-transcripts", ".cursor", "_node_cache", "coverage", ".turbo"}


def safe_print(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        print(s, flush=True)
    except UnicodeEncodeError:
        sys.stdout.buffer.write((s + "\n").encode("utf-8", "replace"))
        sys.stdout.flush()


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


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> int:
    safe_print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout, get_pty=True)
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            safe_print(stdout.channel.recv(8192).decode("utf-8", "replace"))
        if stderr.channel.recv_stderr_ready():
            safe_print(stderr.channel.recv_stderr(8192).decode("utf-8", "replace"))
        time.sleep(0.05)
    while stdout.channel.recv_ready():
        safe_print(stdout.channel.recv(8192).decode("utf-8", "replace"))
    while stderr.channel.recv_stderr_ready():
        safe_print(stderr.channel.recv_stderr(8192).decode("utf-8", "replace"))
    code = stdout.channel.recv_exit_status()
    safe_print(f"[exit {code}]")
    return code


def sftp_put(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    size = local.stat().st_size
    safe_print(f"UPLOAD {local.name} ({size / 1e6:.1f} MB) -> {remote}")
    last = [0.0]

    def cb(transferred: int, total: int) -> None:
        now = time.time()
        if now - last[0] > 3 or transferred == total:
            pct = (100.0 * transferred / total) if total else 0
            safe_print(f"  {pct:5.1f}%  {transferred / 1e6:.1f}/{total / 1e6:.1f} MB")
            last[0] = now

    sftp.put(str(local), remote, callback=cb)


def filter_tar(tarinfo: tarfile.TarInfo) -> tarfile.TarInfo | None:
    name = tarinfo.name.replace("\\", "/")
    parts = name.split("/")
    # arcname starts with app/
    body = parts[1:] if parts and parts[0] == "app" else parts
    if not body:
        return tarinfo
    top = body[0]
    if top in SKIP_TOP:
        return None
    if top == "deploy" and len(body) > 1 and body[1].startswith("_"):
        return None
    # drop nested junk but keep node_modules and .output
    if any(p in {".git", "sources", "coverage", ".turbo", "__pycache__"} for p in body):
        return None
    if name.endswith((".log", ".tmp")):
        return None
    return tarinfo


def build_app_tarball() -> Path:
    out = Path(tempfile.gettempdir()) / "crm-app-deploy.tgz"
    safe_print(f"Packing {ROOT} -> {out}")
    with tarfile.open(out, "w:gz", compresslevel=5) as tar:
        tar.add(ROOT, arcname="app", filter=filter_tar)
    safe_print(f"Tarball size: {out.stat().st_size / 1e6:.1f} MB")
    return out


def main() -> int:
    if not NODE_TAR.exists() or NODE_TAR.stat().st_size < 1_000_000:
        safe_print(f"Missing node tarball: {NODE_TAR}")
        return 1

    dash = ROOT / "apps" / "dashboard" / ".output" / "server" / "index.mjs"
    if not dash.exists():
        safe_print("Dashboard .output missing — build locally first")
        return 1
    for rel in ("node_modules", "apps/api/node_modules", "apps/dashboard/node_modules"):
        if not (ROOT / rel).exists():
            safe_print(f"Missing {rel}")
            return 1

    # Ensure pm2 available to copy (global or local)
    pm2_src = None
    for cand in (
        ROOT / "node_modules" / "pm2",
        Path(os.environ.get("APPDATA", "")) / "npm" / "node_modules" / "pm2",
    ):
        if cand.exists():
            pm2_src = cand
            break

    app_tar = build_app_tarball()
    c = connect()
    safe_print("SSH OK")
    sftp = c.open_sftp()
    sftp_put(sftp, NODE_TAR, "/tmp/node-v22.14.0-linux-x64.tar.xz")
    sftp_put(sftp, app_tar, "/tmp/crm-app-deploy.tgz")
    if pm2_src:
        pm2_tar = Path(tempfile.gettempdir()) / "pm2-mod.tgz"
        with tarfile.open(pm2_tar, "w:gz") as tar:
            tar.add(pm2_src, arcname="pm2")
            # also pack pm2 deps from same node_modules if local
            parent = pm2_src.parent
            for dep in ("pidusage", "blessed", "chalk", "croner", "dayjs", "debug", "enquirer",
                        "lodash", "mkdirp", "needle", "nssocket", "js-yaml", "sprintf-js",
                        "systeminformation", "vizion", "yamljs", "semver", "commander",
                        "ansi-colors", "async", "extrareqp2", "fclone", "pm2-axon",
                        "pm2-axon-rpc", "pm2-deploy", "pm2-multimeter", "promptly",
                        "source-map-support", "sprintf-js", "@pm2"):
                d = parent / dep
                if d.exists():
                    tar.add(d, arcname=dep)
        sftp_put(sftp, pm2_tar, "/tmp/pm2-mod.tgz")
    sftp.close()

    code = run(
        c,
        rf"""
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
PUBLIC_HOST={PUBLIC_HOST}
ADMIN_SAMAN_PASSWORD='{ADMIN_PASS}'
APP_USER=crm
APP_ROOT=/opt/crm
APP_DIR=$APP_ROOT/app
DATA_DIR=$APP_ROOT/data
LOG_DIR=$APP_ROOT/logs
API_PORT=4000
WEB_PORT=3000

echo '==> swap'
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo '==> packages'
apt-get install -y --no-install-recommends ca-certificates curl nginx ufw fail2ban redis-server xz-utils openssl >/tmp/apt-crm.log 2>&1 || true
systemctl enable --now nginx 2>/dev/null || true
systemctl enable --now redis-server 2>/dev/null || systemctl enable --now redis 2>/dev/null || true

echo '==> node'
tar -xJf /tmp/node-v22.14.0-linux-x64.tar.xz -C /usr/local --strip-components=1
hash -r || true
node -v
npm -v

echo '==> pm2 offline'
if [ -f /tmp/pm2-mod.tgz ]; then
  mkdir -p /usr/local/lib/node_modules
  tar -xzf /tmp/pm2-mod.tgz -C /usr/local/lib/node_modules
  ln -sfn /usr/local/lib/node_modules/pm2/bin/pm2 /usr/local/bin/pm2
  ln -sfn /usr/local/lib/node_modules/pm2/bin/pm2 /usr/local/bin/pm2-runtime || true
fi
command -v pm2 && pm2 -v || echo 'WARN pm2 missing'

echo '==> extract app'
id -u $APP_USER >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash $APP_USER
mkdir -p "$DATA_DIR" "$LOG_DIR" "$APP_ROOT/run"
[ -f "$APP_DIR/.env" ] && cp "$APP_DIR/.env" /tmp/crm.env.bak || true
rm -rf "$APP_DIR"
mkdir -p "$APP_ROOT"
tar -xzf /tmp/crm-app-deploy.tgz -C "$APP_ROOT"
# expects /opt/crm/app/...
[ -f /tmp/crm.env.bak ] && cp /tmp/crm.env.bak "$APP_DIR/.env" || true
chown -R $APP_USER:$APP_USER "$APP_ROOT"
test -f "$APP_DIR/apps/dashboard/.output/server/index.mjs"
ls "$APP_DIR/apps/api/node_modules" >/dev/null
ls "$APP_DIR/node_modules" >/dev/null

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
PORT=$API_PORT
DATABASE_URL="file:$DATA_DIR/prod.db"
REDIS_URL=redis://127.0.0.1:6379
CORS_ORIGINS=http://$PUBLIC_HOST,http://$PUBLIC_HOST:80,http://127.0.0.1
JWT_ACCESS_SECRET=$ACCESS_SECRET
JWT_REFRESH_SECRET=$REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BANK_DATA_ENCRYPTION_KEY=$BANK_KEY
BOT_INTERNAL_API_KEY=$BOT_KEY
TELEGRAM_BOT_TOKEN=
SEED_OWNER_USERNAME=owner
SEED_OWNER_PASSWORD=$OWNER_PASS
SEED_OWNER_EMAIL=owner@$PUBLIC_HOST
AUDIT_RETENTION_DAYS=90
NUXT_PUBLIC_API_BASE=http://$PUBLIC_HOST/api/v1
EOF
  echo "$OWNER_PASS" > $APP_ROOT/CREDENTIALS.txt
  chmod 600 $APP_ROOT/CREDENTIALS.txt
else
  sed -i "s|^HOST=.*|HOST=127.0.0.1|" "$ENV_FILE" || true
  grep -q '^HOST=' "$ENV_FILE" || echo 'HOST=127.0.0.1' >> "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:$DATA_DIR/prod.db\"|" "$ENV_FILE"
  if grep -q '^NUXT_PUBLIC_API_BASE=' "$ENV_FILE"; then
    sed -i "s|^NUXT_PUBLIC_API_BASE=.*|NUXT_PUBLIC_API_BASE=http://$PUBLIC_HOST/api/v1|" "$ENV_FILE"
  else
    echo "NUXT_PUBLIC_API_BASE=http://$PUBLIC_HOST/api/v1" >> "$ENV_FILE"
  fi
  sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://$PUBLIC_HOST,http://$PUBLIC_HOST:80,http://127.0.0.1|" "$ENV_FILE"
fi
chown $APP_USER:$APP_USER "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo '==> prisma'
cd "$APP_DIR"
sudo -u $APP_USER ./node_modules/.bin/prisma generate --schema prisma/schema.prisma 2>/dev/null \
  || sudo -u $APP_USER npx prisma generate --schema prisma/schema.prisma || true
if [ ! -f "$DATA_DIR/prod.db" ]; then
  sudo -u $APP_USER DATABASE_URL="file:$DATA_DIR/prod.db" ./node_modules/.bin/prisma db push --schema prisma/schema.prisma --accept-data-loss \
    || sudo -u $APP_USER DATABASE_URL="file:$DATA_DIR/prod.db" npx prisma db push --schema prisma/schema.prisma --accept-data-loss
  sudo -u $APP_USER bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && npm run db:seed --prefix apps/api" || true
  touch "$DATA_DIR/.seeded"
fi
chown -R $APP_USER:$APP_USER "$DATA_DIR"

echo '==> admin saman'
printf '%s\n' "$ADMIN_SAMAN_PASSWORD" > $APP_ROOT/ADMIN_SAMAN.txt
chmod 600 $APP_ROOT/ADMIN_SAMAN.txt
sudo -u $APP_USER bash -lc "cd '$APP_DIR/apps/api' && DATABASE_URL=\"file:$DATA_DIR/prod.db\" node scripts/create-admin-user.mjs saman '$ADMIN_SAMAN_PASSWORD' saman admin" || true

echo '==> ecosystem'
cat > $APP_ROOT/ecosystem.config.cjs <<EOF
module.exports = {{
  apps: [
    {{
      name: 'crm-api',
      cwd: '$APP_DIR/apps/api',
      script: 'npx',
      args: 'tsx src/index.ts',
      interpreter: 'none',
      env: {{
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '$API_PORT',
        DOTENV_CONFIG_PATH: '$APP_DIR/.env',
      }},
      instances: 1,
      autorestart: true,
      max_memory_restart: '350M',
      out_file: '$LOG_DIR/api.out.log',
      error_file: '$LOG_DIR/api.err.log',
      time: true,
      merge_logs: true,
    }},
    {{
      name: 'crm-web',
      cwd: '$APP_DIR/apps/dashboard',
      script: 'node',
      args: '.output/server/index.mjs',
      env: {{
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '$WEB_PORT',
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: '$WEB_PORT',
        NUXT_PUBLIC_API_BASE: 'http://$PUBLIC_HOST/api/v1',
      }},
      instances: 1,
      autorestart: true,
      max_memory_restart: '350M',
      out_file: '$LOG_DIR/web.out.log',
      error_file: '$LOG_DIR/web.err.log',
      time: true,
      merge_logs: true,
    }},
  ],
}};
EOF
chown $APP_USER:$APP_USER $APP_ROOT/ecosystem.config.cjs
sudo -u $APP_USER bash -lc "cd '$APP_DIR' && set -a && . ./.env && set +a && (pm2 delete crm-api crm-web 2>/dev/null || true); pm2 start '$APP_ROOT/ecosystem.config.cjs'; pm2 save"
env PATH="$PATH" pm2 startup systemd -u $APP_USER --hp /home/$APP_USER 2>/dev/null | tail -n 1 | bash || true

echo '==> nginx'
cat > /etc/nginx/sites-available/crm <<'NGX'
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
NGX
ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ufw allow 9011/tcp || true
ufw allow 80/tcp || true
ufw --force enable || true

sleep 5
echo '==> VERIFY'
sudo -u $APP_USER pm2 status || true
ss -lntp | grep -E ':(80|3000|4000) ' || true
curl -fsS --max-time 8 http://127.0.0.1:4000/api/v1/health || echo API_FAIL
echo
curl -fsS -o /dev/null -w 'web=%{http_code}\n' --max-time 8 http://127.0.0.1:3000/ || echo WEB_FAIL
curl -fsS -o /dev/null -w 'proxy=%{http_code}\n' --max-time 8 http://127.0.0.1/ || echo PROXY_FAIL
echo -n 'saman / '; cat $APP_ROOT/ADMIN_SAMAN.txt; echo
echo -n 'owner / '; cat $APP_ROOT/CREDENTIALS.txt 2>/dev/null; echo
echo "URL: http://$PUBLIC_HOST/"
""",
    )
    c.close()
    return 0 if code == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
