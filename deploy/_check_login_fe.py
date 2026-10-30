#!/usr/bin/env python3
import json
import sys
import urllib.request

import paramiko

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


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
cmd = r"""
echo '=== env ==='
grep -E 'NUXT|CORS|HOST|PORT|DATABASE' /opt/crm/app/.env
echo '=== web unit ==='
systemctl cat crm-web | sed -n '1,40p'
echo '=== api err last ==='
tail -n 50 /opt/crm/logs/api.err.log
echo '=== find api base in build ==='
grep -Rao 'NUXT_PUBLIC_API_BASE\|87.107.54.193\|localhost:4000\|/api/v1' /opt/crm/app/apps/dashboard/.output/public/_nuxt 2>/dev/null | head -40
grep -Rao 'http://[^\" ]*api[^\" ]*' /opt/crm/app/apps/dashboard/.output/server 2>/dev/null | head -30
echo '=== login page via curl ==='
curl -sS http://127.0.0.1/login 2>/dev/null | head -c 500; echo
"""
_, o, _ = c.exec_command(cmd, timeout=60)
p(o.read().decode("utf-8", "replace"))
c.close()

# What does FE call? Try common wrong paths
for path in [
    "/api/v1/auth/login",
    "/api/auth/login",
    "/auth/login",
]:
    data = json.dumps({"username": "saman", "password": "Saman@Crm2026!"}).encode()
    req = urllib.request.Request(
        f"http://{HOST}{path}",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Origin": f"http://{HOST}",
            "Referer": f"http://{HOST}/login",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            p(f"POST {path} -> {r.status}")
    except Exception as e:
        code = getattr(e, "code", None)
        body = ""
        if hasattr(e, "read"):
            try:
                body = e.read().decode("utf-8", "replace")[:200]
            except Exception:
                pass
        p(f"POST {path} -> {code or e} {body}")
