#!/usr/bin/env python3
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import paramiko

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
DB = Path(__file__).with_name("_prod_seed.db")


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def http_login(user: str, pw: str):
    data = json.dumps({"username": user, "password": pw}).encode()
    req = urllib.request.Request(
        f"http://{HOST}/api/v1/auth/login",
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
    except Exception as e:
        return 0, str(e)


def main() -> int:
    if not DB.exists():
        p(f"missing {DB}")
        return 1
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
    p(f"Upload {DB.name} ({DB.stat().st_size} bytes)")
    # stop api while replacing db
    _, o, _ = c.exec_command("systemctl stop crm-api", timeout=30)
    o.channel.recv_exit_status()
    sftp = c.open_sftp()
    sftp.put(str(DB), "/opt/crm/data/prod.db")
    sftp.close()
    cmd = r"""
chown crm:crm /opt/crm/data/prod.db
chmod 600 /opt/crm/data/prod.db
# ensure .env points to this db
grep DATABASE_URL /opt/crm/app/.env
systemctl start crm-api
sleep 4
systemctl is-active crm-api
curl -fsS http://127.0.0.1:4000/api/v1/health; echo
curl -fsS -o /dev/null -w 'web=%{http_code} proxy=%{http_code}\n' http://127.0.0.1/
"""
    _, out, _ = c.exec_command(cmd, timeout=60, get_pty=True)
    while not out.channel.exit_status_ready():
        if out.channel.recv_ready():
            p(out.channel.recv(8192).decode("utf-8", "replace"))
        time.sleep(0.05)
    while out.channel.recv_ready():
        p(out.channel.recv(8192).decode("utf-8", "replace"))
    c.close()

    p("\n=== public login ===")
    for user, pw in (("saman", "Saman@Crm2026!"), ("owner", "kPr7BbkX3rCwAa1")):
        code, body = http_login(user, pw)
        p(f"{user}: {code}")
        if isinstance(body, dict):
            data = body.get("data") or {}
            token = data.get("accessToken") or data.get("tokens", {}).get("accessToken")
            userinfo = data.get("user") or {}
            p(f"  success={body.get('success')} user={userinfo.get('username')} token={'yes' if token else 'no'}")
            if token:
                req = urllib.request.Request(
                    f"http://{HOST}/api/v1/auth/me",
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
                )
                with urllib.request.urlopen(req, timeout=12) as resp:
                    me = json.loads(resp.read().decode())
                p(f"  /me ok user={((me.get('data') or {}).get('user') or me.get('data') or {}).get('username')}")
        else:
            p(f"  {str(body)[:300]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
