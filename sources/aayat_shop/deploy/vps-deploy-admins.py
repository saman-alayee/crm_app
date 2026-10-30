#!/usr/bin/env python3
"""Deploy auth updates and create admin accounts on VPS."""

from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")

ADMINS = [
    {"phone": "09051770091", "firstName": "ادمین", "lastName": "۱"},
    {"phone": "09376030633", "firstName": "ادمین", "lastName": "۲"},
]
ADMIN_PASSWORD = "KiaaKala@1405"


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    t = client.get_transport()
    if t:
        t.set_keepalive(15)
    return client


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 900) -> tuple[int, str]:
    print(f"\n$ {cmd[:120]}...")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip()[:4000])
    if err.strip():
        print(err.rstrip()[:2000], file=sys.stderr)
    return code, out


def make_bundle() -> bytes:
    backend_dist = ROOT / "backend" / "dist"
    backend_pkg = ROOT / "backend" / "package.json"
    backend_lock = ROOT / "backend" / "package-lock.json"
    backend_prisma = ROOT / "backend" / "prisma"
    frontend_out = ROOT / "frontend" / ".output" / "public"

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in [backend_dist, backend_pkg, backend_lock, backend_prisma]:
            if item.is_dir():
                for path in item.rglob("*"):
                    if path.is_file():
                        tar.add(str(path), arcname=str(Path("backend") / path.relative_to(ROOT / "backend")))
            else:
                tar.add(str(item), arcname=f"backend/{item.name}")
        for path in frontend_out.rglob("*"):
            if path.is_file():
                tar.add(str(path), arcname=str(Path("frontend") / path.relative_to(frontend_out)))
    return buf.getvalue()


def main() -> int:
    bundle = make_bundle()
    print(f"Bundle: {len(bundle)/1024/1024:.1f} MB")
    client = connect()

    sftp = client.open_sftp()
    with sftp.file("/tmp/kiaakala-update.tar.gz", "wb") as f:
        chunk = 64 * 1024
        for i in range(0, len(bundle), chunk):
            f.write(bundle[i : i + chunk])
    sftp.close()
    print("Uploaded bundle")

    code, _ = run(
        client,
        r"""
set -e
rm -rf /tmp/kiaakala-update
mkdir -p /tmp/kiaakala-update
tar -xzf /tmp/kiaakala-update.tar.gz -C /tmp/kiaakala-update
cp -a /tmp/kiaakala-update/backend/dist /opt/kiaakala/api/
cp -a /tmp/kiaakala-update/backend/package.json /opt/kiaakala/api/
cp -a /tmp/kiaakala-update/backend/package-lock.json /opt/kiaakala/api/
cp -a /tmp/kiaakala-update/backend/prisma /opt/kiaakala/api/
find /var/www/kiaakala -mindepth 1 -maxdepth 1 ! -name 'uploads' -exec rm -rf {} +
cp -a /tmp/kiaakala-update/frontend/. /var/www/kiaakala/
chown -R www-data:www-data /var/www/kiaakala
cd /opt/kiaakala/api
# keep OTP_DEV_MODE=false
sed -i 's/^OTP_DEV_MODE=.*/OTP_DEV_MODE=false/' .env || true
npm ci --omit=dev
npx prisma generate
npx prisma db push --accept-data-loss
pm2 delete kiaakala-api 2>/dev/null || true
pm2 start dist/index.js --name kiaakala-api --cwd /opt/kiaakala/api
pm2 save
sleep 2
curl -sS http://127.0.0.1:3001/api/health
""",
        timeout=900,
    )
    if code != 0:
        client.close()
        return code

    # Create admin accounts with password via node on server
    admins_js = ",\n".join(
        [
            f"  {{ phone: '{a['phone']}', firstName: '{a['firstName']}', lastName: '{a['lastName']}' }}"
            for a in ADMINS
        ]
    )
    create_script = f"""
const bcrypt = require('bcryptjs');
const {{ PrismaClient }} = require('@prisma/client');
const prisma = new PrismaClient();
const password = {ADMIN_PASSWORD!r};
const admins = [
{admins_js}
];
(async () => {{
  const passwordHash = await bcrypt.hash(password, 10);
  for (const a of admins) {{
    const user = await prisma.user.upsert({{
      where: {{ phone: a.phone }},
      update: {{ role: 'ADMIN', isActive: true, firstName: a.firstName, lastName: a.lastName, passwordHash }},
      create: {{ phone: a.phone, role: 'ADMIN', isActive: true, firstName: a.firstName, lastName: a.lastName, passwordHash }},
      select: {{ id: true, phone: true, role: true }},
    }});
    console.log('ADMIN_OK', user.phone, user.role);
  }}
  await prisma.$disconnect();
}})().catch((e) => {{ console.error(e); process.exit(1); }});
"""
    sftp = client.open_sftp()
    with sftp.file("/tmp/create-admins.js", "w") as f:
        f.write(create_script)
    sftp.close()

    code, out = run(client, "cd /opt/kiaakala/api && node /tmp/create-admins.js && rm -f /tmp/create-admins.js")
    client.close()

    print("\n=== Done ===")
    print("Customer login: http://kiaakala.ir/auth/login")
    print("Admin login:    http://kiaakala.ir/admin/login")
    print("Admin phones:   09051770091 , 09376030633")
    print(f"Temp password:  {ADMIN_PASSWORD}")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
