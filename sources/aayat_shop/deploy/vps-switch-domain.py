#!/usr/bin/env python3
"""Switch production domain to jetkala.shop on the VPS (nginx + SSL + CORS)."""

from __future__ import annotations

import os
import sys
import time

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")
REPO_DIR = "/opt/kiaakala/src"
NEW_DOMAIN = "jetkala.shop"
ADMIN_EMAIL = os.environ.get("SSL_EMAIL", "admin@jetkala.shop")

CORS = (
    "https://jetkala.shop,https://www.jetkala.shop,"
    "https://kiaakala.ir,https://www.kiaakala.ir,"
    "http://45.94.215.57"
)

REMOTE = rf"""
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

echo "==> DNS check"
dig +short {NEW_DOMAIN} A || true
dig +short www.{NEW_DOMAIN} A || true

echo "==> Install certbot if needed"
command -v certbot >/dev/null 2>&1 || apt-get update -y && apt-get install -y certbot python3-certbot-nginx

echo "==> Pull latest repo"
mkdir -p /opt/kiaakala
if [ -d {REPO_DIR}/.git ]; then
  cd {REPO_DIR}
  git fetch origin main
  git reset --hard origin/main
else
  git clone --branch main https://github.com/saman-alayee/supermarket.git {REPO_DIR}
fi
cd {REPO_DIR}
git log -1 --oneline

echo "==> Stage 1: HTTP-only nginx for ACME"
cat > /etc/nginx/sites-available/jetkala <<'NGINX_HTTP'
server {{
    listen 80;
    listen [::]:80;
    server_name jetkala.shop www.jetkala.shop kiaakala.ir www.kiaakala.ir;

    location ^~ /.well-known/ {{
        alias /opt/kiaakala/ssl/.well-known/;
        default_type text/plain;
        allow all;
    }}

    root /var/www/kiaakala;
    index index.html;

    location /api/ {{
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    location / {{
        try_files $uri/index.html $uri /index.html;
    }}
}}
NGINX_HTTP

ln -sfn /etc/nginx/sites-available/jetkala /etc/nginx/sites-enabled/jetkala
rm -f /etc/nginx/sites-enabled/kiaakala
nginx -t && systemctl reload nginx

echo "==> Issue Let's Encrypt certificate"
certbot certonly --webroot -w /var/www/kiaakala \
  -d jetkala.shop -d www.jetkala.shop \
  --non-interactive --agree-tos -m {ADMIN_EMAIL} \
  --deploy-hook "systemctl reload nginx" 2>&1 || \
certbot certonly --nginx \
  -d jetkala.shop -d www.jetkala.shop \
  --non-interactive --agree-tos -m {ADMIN_EMAIL} 2>&1 || \
echo "CERTBOT_WARN: SSL not issued yet (DNS may still be propagating)"

echo "==> Stage 2: nginx config"
if [ -f /etc/letsencrypt/live/jetkala.shop/fullchain.pem ]; then
  cp {REPO_DIR}/deploy/vps/nginx-jetkala.conf /etc/nginx/sites-available/jetkala
else
  echo "Using HTTP-only nginx until SSL certificate is available"
  cat > /etc/nginx/sites-available/jetkala <<'NGINX_HTTP'
server {{
    listen 80;
    listen [::]:80;
    server_name jetkala.shop www.jetkala.shop kiaakala.ir www.kiaakala.ir 45.94.215.57;

    location ^~ /.well-known/ {{
        alias /opt/kiaakala/ssl/.well-known/;
        default_type text/plain;
        allow all;
    }}

    client_max_body_size 10M;
    root /var/www/kiaakala;
    index index.html;

    location /_nuxt/ {{
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }}

    location /api/ {{
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Session-Id $http_x_session_id;
    }}

    location /uploads/ {{
        alias /opt/kiaakala/api/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }}

    location /images/ {{
        alias /var/www/kiaakala/images/;
        expires 30d;
        add_header Cache-Control "public";
    }}

    location = /sw.js {{
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }}

    location / {{
        try_files $uri/index.html $uri /index.html;
    }}
}}
NGINX_HTTP
fi
ln -sfn /etc/nginx/sites-available/jetkala /etc/nginx/sites-enabled/jetkala
nginx -t && systemctl reload nginx

echo "==> Update CORS"
python3 - <<'PY'
from pathlib import Path
p = Path('/opt/kiaakala/api/.env')
if not p.exists():
    raise SystemExit('Missing /opt/kiaakala/api/.env')
lines = p.read_text(encoding='utf-8').splitlines()
out = []
seen = False
for ln in lines:
    if ln.startswith('CORS_ORIGIN='):
        out.append('CORS_ORIGIN={CORS}')
        seen = True
    else:
        out.append(ln)
if not seen:
    out.append('CORS_ORIGIN={CORS}')
p.write_text(chr(10).join(out) + chr(10), encoding='utf-8')
print('CORS_OK', '{CORS}')
PY

pm2 restart kiaakala-api 2>/dev/null || true
sleep 2

echo "==> Smoke tests"
curl -sS -o /dev/null -w 'http_jet:%{{http_code}}\\n' http://jetkala.shop/
curl -sS -o /dev/null -w 'https_jet:%{{http_code}}\\n' https://jetkala.shop/ 2>/dev/null || echo https_jet:fail
curl -sS -o /dev/null -w 'api:%{{http_code}}\\n' https://jetkala.shop/api/health 2>/dev/null || curl -sS http://127.0.0.1:3001/api/health
curl -sS -o /dev/null -w 'legacy:%{{http_code}} loc:%{{redirect_url}}\\n' http://kiaakala.ir/ 2>/dev/null || true
echo DOMAIN_SWITCH_OK
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"Connecting to {HOST}...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    transport = client.get_transport()
    if transport:
        transport.set_keepalive(15)
    print("Switching domain to jetkala.shop...", flush=True)

    _, stdout, stderr = client.exec_command(REMOTE, timeout=900)
    while True:
        if stdout.channel.recv_ready():
            print(stdout.channel.recv(65536).decode("utf-8", "replace"), end="", flush=True)
        if stderr.channel.recv_stderr_ready():
            print(stderr.channel.recv_stderr(65536).decode("utf-8", "replace"), end="", file=sys.stderr, flush=True)
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready() and not stderr.channel.recv_stderr_ready():
            break
        time.sleep(0.2)
    leftover = stdout.read().decode("utf-8", "replace")
    leftover_err = stderr.read().decode("utf-8", "replace")
    if leftover:
        print(leftover, end="", flush=True)
    if leftover_err:
        print(leftover_err, end="", file=sys.stderr, flush=True)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
