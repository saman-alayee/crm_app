#!/usr/bin/env python3
"""Create SQLite schema, seed owner, create saman admin on VPS."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

import paramiko

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
ADMIN_PASS = "Saman@Crm2026!"


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 300) -> int:
    p(f"\n$ {cmd[:220]}...")
    _, out, err = c.exec_command(cmd, timeout=timeout, get_pty=True)
    while not out.channel.exit_status_ready():
        if out.channel.recv_ready():
            p(out.channel.recv(8192).decode("utf-8", "replace"))
        time.sleep(0.05)
    while out.channel.recv_ready():
        p(out.channel.recv(8192).decode("utf-8", "replace"))
    code = out.channel.recv_exit_status()
    p(f"[exit {code}]")
    return code


def http_json(url: str, data: dict | None = None):
    body = None
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if data is not None:
        body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}
    except Exception as e:
        return 0, {"error": str(e)}


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
    run(
        c,
        r"""
set -e
APP=/opt/crm/app
DB=/opt/crm/data/prod.db
ls -la /opt/crm/data || mkdir -p /opt/crm/data
# show current tables if any
sqlite3 "$DB" '.tables' 2>/dev/null || echo 'no sqlite3 or empty db'
cd "$APP"
sudo -u crm bash -lc "cd '$APP' && DATABASE_URL=\"file:$DB\" npx prisma db push --schema prisma/schema.prisma --accept-data-loss"
chown -R crm:crm /opt/crm/data
sqlite3 "$DB" '.tables' 2>/dev/null || true
# seed if no users
COUNT=$(sqlite3 "$DB" 'select count(*) from users;' 2>/dev/null || echo 0)
echo users=$COUNT
if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
  sudo -u crm bash -lc "cd '$APP' && set -a && . ./.env && set +a && DATABASE_URL=\"file:$DB\" npm run db:seed --prefix apps/api"
fi
# ensure saman
sudo -u crm bash -lc "cd '$APP/apps/api' && DATABASE_URL=\"file:$DB\" node scripts/create-admin-user.mjs saman 'Saman@Crm2026!' saman admin" || true
sqlite3 "$DB" "select id,username,role from users;" 2>/dev/null || sqlite3 "$DB" "select id,username from users;" 2>/dev/null || true
systemctl restart crm-api
sleep 4
curl -fsS http://127.0.0.1:4000/api/v1/health; echo
""",
        timeout=400,
    )
    c.close()

    p("\n=== login tests ===")
    for user, pw in (("saman", ADMIN_PASS), ("owner", None)):
        if user == "owner":
            # read owner pass from server via fresh ssh
            c2 = paramiko.SSHClient()
            c2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            c2.connect(
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
            _, o, _ = c2.exec_command("cat /opt/crm/CREDENTIALS.txt", timeout=20)
            pw = o.read().decode().strip()
            c2.close()
        code, j = http_json(
            f"http://{HOST}/api/v1/auth/login",
            {"username": user, "password": pw},
        )
        ok = code == 200 and (j.get("success") is True or "accessToken" in str(j))
        p(f"{user}: HTTP {code} ok={ok}")
        if isinstance(j, dict):
            data = j.get("data") or {}
            u = data.get("user") or {}
            p(f"  username={u.get('username')} keys={list(data.keys())[:6]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
