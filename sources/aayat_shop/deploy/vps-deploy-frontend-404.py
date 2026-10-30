#!/usr/bin/env python3
"""Deploy frontend static + nginx SPA fix to VPS."""

from __future__ import annotations

import io
import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")

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
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str, str]:
    print(f"\n$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    return code, out, err


def make_frontend_bundle() -> bytes:
    if not FRONTEND_OUT.exists():
        raise RuntimeError("Missing frontend/.output/public — run npm run generate first")
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in FRONTEND_OUT.rglob("*"):
            if path.is_file():
                tar.add(str(path), arcname=str(Path("frontend") / path.relative_to(FRONTEND_OUT)))
        tar.add(str(NGINX_CONF), arcname="nginx-kiaakala.conf")
    return buf.getvalue()


def upload_bytes(client: paramiko.SSHClient, remote: str, data: bytes) -> None:
    sftp = client.open_sftp()
    with sftp.file(remote, "wb") as f:
        chunk = 64 * 1024
        for i in range(0, len(data), chunk):
            f.write(data[i : i + chunk])
    sftp.close()
    print(f"Uploaded {remote} ({len(data) / 1024 / 1024:.1f} MB)")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print("Creating frontend bundle...")
    bundle = make_frontend_bundle()
    print(f"Bundle size: {len(bundle) / 1024 / 1024:.1f} MB")

    client = connect()
    upload_bytes(client, "/tmp/kiaakala-frontend.tar.gz", bundle)

    code, _, _ = run(
        client,
        r"""
set -e
rm -rf /tmp/kiaakala-fe
mkdir -p /tmp/kiaakala-fe /var/www/kiaakala
tar -xzf /tmp/kiaakala-frontend.tar.gz -C /tmp/kiaakala-fe

# Replace frontend static (keep any local uploads dir if present under www)
find /var/www/kiaakala -mindepth 1 -maxdepth 1 ! -name 'uploads' -exec rm -rf {} +
cp -a /tmp/kiaakala-fe/frontend/. /var/www/kiaakala/
chown -R www-data:www-data /var/www/kiaakala

# Nginx SPA fix
cp /tmp/kiaakala-fe/nginx-kiaakala.conf /etc/nginx/sites-available/kiaakala
ln -sfn /etc/nginx/sites-available/kiaakala /etc/nginx/sites-enabled/kiaakala
nginx -t
systemctl reload nginx

echo '=== SMOKE ==='
for u in / /profile /profile/ /profile/password /profile/password/ /profile/edit /auth/login /does-not-exist; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 8 "http://127.0.0.1$u")
  redir=$(curl -sI -m 8 "http://127.0.0.1$u" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2}')
  echo "$code $u ${redir:-}"
done
grep -n try_files /etc/nginx/sites-enabled/kiaakala
test -f /var/www/kiaakala/profile/password/index.html && echo 'password page: OK'
""",
        timeout=180,
    )

    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
