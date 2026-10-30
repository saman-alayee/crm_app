#!/usr/bin/env python3
"""Verify FE+BE on VPS and via public IP."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

import paramiko

HOST = "87.107.54.193"
SSH_PORT = 9011
PASSWORD = "JFbkq4img1"
PUBLIC = f"http://{HOST}"


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def http(url: str, method: str = "GET", data: dict | None = None, token: str | None = None, timeout: int = 12):
    body = None
    headers = {"Accept": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        return e.code, raw
    except Exception as e:
        return 0, str(e)


def main() -> int:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        SSH_PORT,
        username="root",
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    p("SSH OK")
    cmd = r"""
echo '=== systemd ==='
systemctl is-active crm-api crm-web nginx redis-server 2>/dev/null || systemctl is-active crm-api crm-web nginx redis 2>/dev/null
echo '=== ports ==='
ss -lntp | grep -E ':(80|3000|4000) ' || true
echo '=== local curls ==='
curl -fsS --max-time 6 http://127.0.0.1:4000/api/v1/health; echo
curl -fsS -o /dev/null -w 'web_local=%{http_code}\n' --max-time 6 http://127.0.0.1:3000/
curl -fsS -o /dev/null -w 'proxy_root=%{http_code}\n' --max-time 6 http://127.0.0.1/
curl -fsS --max-time 6 http://127.0.0.1/api/v1/health; echo
echo '=== mem ==='
free -h | head -2
echo '=== recent api err ==='
tail -n 15 /opt/crm/logs/api.err.log 2>/dev/null || true
echo '=== recent web err ==='
tail -n 15 /opt/crm/logs/web.err.log 2>/dev/null || true
"""
    _, out, _ = c.exec_command(cmd, timeout=60)
    p(out.read().decode("utf-8", "replace"))
    c.close()

    p("=== public checks ===")
    code, body = http(f"{PUBLIC}/api/v1/health")
    p(f"GET /api/v1/health -> {code} {body[:300]}")

    code, body = http(PUBLIC + "/")
    p(f"GET / -> {code} (len={len(body)})")

    # login saman
    code, body = http(
        f"{PUBLIC}/api/v1/auth/login",
        method="POST",
        data={"username": "saman", "password": "Saman@Crm2026!"},
    )
    p(f"POST /auth/login saman -> {code}")
    token = None
    try:
        j = json.loads(body)
        token = (
            j.get("data", {}).get("accessToken")
            or j.get("data", {}).get("access_token")
            or j.get("accessToken")
        )
        user = j.get("data", {}).get("user") or {}
        p(f"  user={user.get('username')} role={user.get('role') or user.get('roles')}")
    except Exception:
        p(f"  body={body[:400]}")

    if token:
        code, body = http(f"{PUBLIC}/api/v1/dashboard/stats", token=token)
        p(f"GET /dashboard/stats -> {code} {body[:250]}")
        code, body = http(f"{PUBLIC}/api/v1/auth/me", token=token)
        p(f"GET /auth/me -> {code} {body[:250]}")

    # owner login
    code, body = http(
        f"{PUBLIC}/api/v1/auth/login",
        method="POST",
        data={"username": "owner", "password": "kPr7BbkX3rCwAa1"},
    )
    p(f"POST /auth/login owner -> {code}")
    try:
        j = json.loads(body)
        ou = j.get("data", {}).get("user") or {}
        p(f"  user={ou.get('username')} role={ou.get('role') or ou.get('roles')}")
    except Exception:
        p(f"  body={body[:300]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
