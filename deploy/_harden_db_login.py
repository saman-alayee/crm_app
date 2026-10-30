#!/usr/bin/env python3
"""Ensure prod.db is valid, API uses it, login works; reseeds if empty."""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

import paramiko

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
LOCAL_DB = Path(__file__).with_name("_prod_seed.db")


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def main() -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        9011,
        username="root",
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )

    _, o, _ = c.exec_command(
        r"""
set -e
DB=/opt/crm/data/prod.db
command -v sqlite3 >/dev/null || apt-get install -y sqlite3 >/dev/null 2>&1
echo size=$(stat -c%s "$DB" 2>/dev/null || echo 0)
echo users=$(sqlite3 "$DB" 'select count(*) from users;' 2>/dev/null || echo ERR)
# what DB does running API see?
pid=$(systemctl show -p MainPID --value crm-api)
echo pid=$pid
tr '\0' '\n' < /proc/$pid/environ 2>/dev/null | grep -E 'DATABASE_URL|JWT_|HOST|PORT' || true
grep DATABASE_URL /opt/crm/app/.env
""",
        timeout=60,
    )
    info = o.read().decode("utf-8", "replace")
    p(info)

    need_upload = ("users=ERR" in info) or ("users=0" in info) or ("size=0" in info)
    if need_upload:
        if not LOCAL_DB.exists():
            p("local seed db missing")
            return 1
        p("Re-uploading seeded DB...")
        _, o, _ = c.exec_command("systemctl stop crm-api", timeout=30)
        o.channel.recv_exit_status()
        sftp = c.open_sftp()
        sftp.put(str(LOCAL_DB), "/opt/crm/data/prod.db")
        sftp.close()
        _, o, _ = c.exec_command(
            "chown crm:crm /opt/crm/data/prod.db; chmod 660 /opt/crm/data/prod.db; "
            "systemctl start crm-api; sleep 3; systemctl is-active crm-api",
            timeout=40,
        )
        p(o.read().decode())

    # ensure passwords for saman/owner are correct even if DB was old
    # upload a small script to reset via bcrypt using node on server
    reset_js = r"""
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const passes = { saman: 'Saman@Crm2026!', owner: 'kPr7BbkX3rCwAa1' };
for (const [username, password] of Object.entries(passes)) {
  const passwordHash = await bcrypt.hash(password, 12);
  const u = await prisma.user.update({ where: { username }, data: { passwordHash, isActive: true } }).catch(() => null);
  console.log(username, u ? 'updated' : 'missing');
}
await prisma.$disconnect();
"""
    sftp = c.open_sftp()
    with sftp.file("/tmp/reset-pass.mjs", "w") as f:
        f.write(reset_js)
    sftp.close()

    _, o, _ = c.exec_command(
        r"""
set -e
cd /opt/crm/app/apps/api
sudo -u crm bash -lc 'cd /opt/crm/app/apps/api && DATABASE_URL="file:/opt/crm/data/prod.db" node /tmp/reset-pass.mjs'
systemctl restart crm-api
sleep 4
curl -sS -o /tmp/login1.json -w '%{http_code}' -X POST http://127.0.0.1:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"saman","password":"Saman@Crm2026!"}'
echo
curl -sS -o /tmp/login2.json -w '%{http_code}' -X POST http://127.0.0.1:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"owner","password":"kPr7BbkX3rCwAa1"}'
echo
python3 - <<'PY'
import json
for name in ('login1','login2'):
  j=json.load(open(f'/tmp/{name}.json'))
  print(name, 'success=', j.get('success'), 'user=', (j.get('data') or {}).get('user',{}).get('username'))
PY
tail -n 20 /opt/crm/logs/api.err.log || true
""",
        timeout=120,
    )
    p(o.read().decode("utf-8", "replace"))
    c.close()

    # public verify
    for u, pw in (("saman", "Saman@Crm2026!"), ("owner", "kPr7BbkX3rCwAa1")):
        data = json.dumps({"username": u, "password": pw}).encode()
        req = urllib.request.Request(
            f"http://{HOST}/api/v1/auth/login",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            j = json.loads(r.read().decode())
        p(f"public {u}: success={j.get('success')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
