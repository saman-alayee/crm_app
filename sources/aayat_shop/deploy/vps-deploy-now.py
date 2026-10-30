#!/usr/bin/env python3
"""Deploy current local build to VPS and ensure SMS OTP is enabled."""

from __future__ import annotations

import os
import subprocess
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")

BACKEND_DIST = ROOT / "backend" / "dist"
BACKEND_PKG = ROOT / "backend" / "package.json"
BACKEND_LOCK = ROOT / "backend" / "package-lock.json"
BACKEND_PRISMA = ROOT / "backend" / "prisma"
FRONTEND_OUT = ROOT / "frontend" / ".output" / "public"
NGINX_CONF = ROOT / "deploy" / "vps" / "nginx-kiaakala.conf"


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=USER,
        password=PASSWORD,
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )
    transport = client.get_transport()
    if transport:
        transport.set_keepalive(15)
        transport.window_size = 2147483647
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:120]}...", flush=True)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out_chunks: list[str] = []
    err_chunks: list[str] = []
    while True:
        if stdout.channel.recv_ready():
            chunk = stdout.channel.recv(65536).decode("utf-8", "replace")
            out_chunks.append(chunk)
            print(chunk, end="", flush=True)
        if stderr.channel.recv_stderr_ready():
            chunk = stderr.channel.recv_stderr(65536).decode("utf-8", "replace")
            err_chunks.append(chunk)
            print(chunk, end="", file=sys.stderr, flush=True)
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready() and not stderr.channel.recv_stderr_ready():
            break
        time.sleep(0.2)
    leftover = stdout.read().decode("utf-8", "replace")
    leftover_err = stderr.read().decode("utf-8", "replace")
    if leftover:
        out_chunks.append(leftover)
        print(leftover, end="", flush=True)
    if leftover_err:
        err_chunks.append(leftover_err)
        print(leftover_err, end="", file=sys.stderr, flush=True)
    code = stdout.channel.recv_exit_status()
    return code, "".join(out_chunks), "".join(err_chunks)


def make_bundle(dest: Path) -> None:
    if not BACKEND_DIST.exists():
        raise RuntimeError("Missing backend/dist — build backend first")
    if not FRONTEND_OUT.exists():
        raise RuntimeError("Missing frontend/.output/public — build frontend first")

    with tarfile.open(dest, mode="w:gz") as tar:
        for item in [BACKEND_DIST, BACKEND_PKG, BACKEND_LOCK, BACKEND_PRISMA]:
            if item.is_dir():
                for path in item.rglob("*"):
                    if path.is_file():
                        tar.add(str(path), arcname=str(Path("backend") / path.relative_to(ROOT / "backend")))
            else:
                tar.add(str(item), arcname=f"backend/{item.name}")

        for path in FRONTEND_OUT.rglob("*"):
            if path.is_file():
                tar.add(str(path), arcname=str(Path("frontend") / path.relative_to(FRONTEND_OUT)))
        tar.add(str(NGINX_CONF), arcname="nginx-kiaakala.conf")


def install_deploy_key(client: paramiko.SSHClient) -> Path:
    key_path = Path(tempfile.gettempdir()) / "kiaakala_deploy_ed25519"
    pub_path = Path(str(key_path) + ".pub")
    if not key_path.exists():
        subprocess.check_call(
            ["ssh-keygen", "-t", "ed25519", "-N", "", "-f", str(key_path), "-C", "kiaakala-deploy"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    pub = pub_path.read_text(encoding="utf-8").strip()
    cmd = (
        "mkdir -p /root/.ssh && chmod 700 /root/.ssh && touch /root/.ssh/authorized_keys && "
        "chmod 600 /root/.ssh/authorized_keys && "
        f"grep -q 'kiaakala-deploy' /root/.ssh/authorized_keys || echo {pub!r} >> /root/.ssh/authorized_keys"
    )
    code, _, err = run(client, cmd, timeout=30)
    if code != 0:
        raise RuntimeError(f"Failed to install deploy key: {err}")
    return key_path


def upload_file(client: paramiko.SSHClient, local: Path, remote: str) -> None:
    size = local.stat().st_size
    print(f"Uploading {remote} ({size / 1024 / 1024:.1f} MB) via scp...", flush=True)
    key_path = install_deploy_key(client)
    cmd = [
        "scp",
        "-i",
        str(key_path),
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "ConnectTimeout=30",
        str(local),
        f"{USER}@{HOST}:{remote}",
    ]
    subprocess.check_call(cmd)
    print("Upload complete.", flush=True)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Creating bundle...", flush=True)
    tmp = Path(tempfile.gettempdir()) / "kiaakala-update.tar.gz"
    make_bundle(tmp)
    print(f"Bundle size: {tmp.stat().st_size / 1024 / 1024:.1f} MB", flush=True)

    client = connect()
    print("Connected to VPS.", flush=True)
    upload_file(client, tmp, "/tmp/kiaakala-update.tar.gz")

    cmds = r"""
set -e
mkdir -p /tmp/kiaakala-update /opt/kiaakala/api /var/www/kiaakala /opt/kiaakala/api/uploads
rm -rf /tmp/kiaakala-update/*
tar -xzf /tmp/kiaakala-update.tar.gz -C /tmp/kiaakala-update

# Keep existing uploads
cp -a /tmp/kiaakala-update/backend/dist /opt/kiaakala/api/
cp -a /tmp/kiaakala-update/backend/package.json /opt/kiaakala/api/
cp -a /tmp/kiaakala-update/backend/package-lock.json /opt/kiaakala/api/
cp -a /tmp/kiaakala-update/backend/prisma /opt/kiaakala/api/

# Replace frontend static files but keep uploads path alone
find /var/www/kiaakala -mindepth 1 -maxdepth 1 ! -name 'uploads' -exec rm -rf {} +
cp -a /tmp/kiaakala-update/frontend/. /var/www/kiaakala/
chown -R www-data:www-data /var/www/kiaakala

# Nginx SPA routing
if [ -f /tmp/kiaakala-update/nginx-kiaakala.conf ]; then
  cp /tmp/kiaakala-update/nginx-kiaakala.conf /etc/nginx/sites-available/kiaakala
  ln -sfn /etc/nginx/sites-available/kiaakala /etc/nginx/sites-enabled/kiaakala
  nginx -t && systemctl reload nginx
fi

cd /opt/kiaakala/api

# Ensure SMS OTP enabled using existing env values when present
python3 - <<'PY'
from pathlib import Path
env_path = Path('/opt/kiaakala/api/.env')
text = env_path.read_text(encoding='utf-8') if env_path.exists() else ''
lines = [ln for ln in text.splitlines() if ln.strip() and not ln.strip().startswith('#')]
kv = {}
for ln in lines:
    if '=' in ln:
        k, v = ln.split('=', 1)
        kv[k.strip()] = v.strip()

# Required production defaults (do not wipe DATABASE_URL / JWT / SMS keys if present)
defaults = {
    'PORT': '3001',
    'NODE_ENV': 'production',
    'REDIS_DISABLED': 'true',
    'JWT_EXPIRES_IN': '7d',
    'OTP_EXPIRES_MINUTES': '5',
    'OTP_DEV_MODE': 'false',
    'FARAZSMS_NUMBER_FORMAT': 'english',
    'FARAZSMS_OTP_ATTRIBUTE': 'code',
    'UPLOAD_DIR': 'uploads',
    'MAX_FILE_SIZE': '5242880',
    'CORS_ORIGIN': 'https://kiaakala.ir,https://www.kiaakala.ir,http://kiaakala.ir,http://www.kiaakala.ir,http://45.94.215.57',
}
for k, v in defaults.items():
    if k == 'OTP_DEV_MODE':
        kv[k] = 'false'
    elif k == 'CORS_ORIGIN':
        kv[k] = v
    elif k not in kv or not kv[k]:
        kv[k] = v

# SMS keys fallback from known panel config only if missing
sms_fallback = {
    'FARAZSMS_API_KEY': 'eCnzKQeW27Uky0ubGYomLOa5zH06hxdCGxKTCiOlauM0uPml2X',
    'FARAZSMS_PATTERN_CODE': 'ZKAFa6RmXD',
    'FARAZSMS_LINE_NUMBER': '90008361',
}
for k, v in sms_fallback.items():
    if k not in kv or not kv[k].strip('\"'):
        kv[k] = v

# Preserve order roughly
order = [
 'PORT','NODE_ENV','DATABASE_URL','REDIS_DISABLED','JWT_SECRET','JWT_EXPIRES_IN',
 'OTP_EXPIRES_MINUTES','OTP_DEV_MODE','FARAZSMS_API_KEY','FARAZSMS_PATTERN_CODE',
 'FARAZSMS_LINE_NUMBER','FARAZSMS_NUMBER_FORMAT','FARAZSMS_OTP_ATTRIBUTE',
 'UPLOAD_DIR','MAX_FILE_SIZE','CORS_ORIGIN','ADMIN_PHONE','ADMIN_PASSWORD'
]
out_lines = []
seen = set()
for k in order:
    if k in kv:
        out_lines.append(f'{k}={kv[k]}')
        seen.add(k)
for k, v in kv.items():
    if k not in seen:
        out_lines.append(f'{k}={v}')
env_path.write_text('\n'.join(out_lines) + '\n', encoding='utf-8')
print('ENV_OK OTP_DEV_MODE=' + kv.get('OTP_DEV_MODE', ''))
print('SMS_CONFIGURED=' + str(bool(kv.get('FARAZSMS_API_KEY') and kv.get('FARAZSMS_PATTERN_CODE') and kv.get('FARAZSMS_LINE_NUMBER'))))
PY
chmod 600 .env

npm ci --omit=dev
npx prisma generate
npx prisma db push --accept-data-loss

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
        await prisma.slider.update({ where: { id: existing.id }, data: { image: s.image, linkUrl: s.linkUrl, isActive: true, placement: 'HOME_TOP' } });
      }
    }
    console.log('SLIDERS_UPDATED count=' + count);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE

pm2 delete kiaakala-api 2>/dev/null || true
pm2 start dist/index.js --name kiaakala-api --cwd /opt/kiaakala/api
pm2 save

sleep 2
curl -sS http://127.0.0.1:3001/api/health; echo
curl -sS -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1/
curl -sS -o /dev/null -w 'slider:%{http_code}\n' http://127.0.0.1/images/sliders/dairy-sale.png
curl -sS -o /dev/null -w 'password:%{http_code}\n' http://127.0.0.1/profile/password
ls -la /var/www/kiaakala/images/sliders/ | head
pm2 status
grep -E '^(OTP_DEV_MODE|FARAZSMS_PATTERN_CODE|FARAZSMS_LINE_NUMBER|NODE_ENV)=' /opt/kiaakala/api/.env
"""

    code, _, _ = run(client, cmds, timeout=900)
    client.close()
    if code != 0:
        print("Deploy failed", file=sys.stderr)
        return code
    print("\nDeploy finished successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
