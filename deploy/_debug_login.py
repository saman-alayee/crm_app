#!/usr/bin/env python3
import json
import sys
import urllib.error
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


def http(method, path, data=None, headers=None):
    h = {"Accept": "application/json", "Origin": f"http://{HOST}", "Referer": f"http://{HOST}/login"}
    if headers:
        h.update(headers)
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(f"http://{HOST}{path}", data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), dict(e.headers)
    except Exception as e:
        return 0, str(e), {}


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
command -v sqlite3 >/dev/null || apt-get install -y sqlite3 >/dev/null 2>&1
echo TABLES:
sqlite3 /opt/crm/data/prod.db '.tables'
echo USERS:
sqlite3 /opt/crm/data/prod.db 'select username from users;'
ls -la /opt/crm/data/prod.db
: > /opt/crm/logs/api.err.log
curl -sS -X POST http://127.0.0.1:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"saman","password":"Saman@Crm2026!"}'
echo
echo ERRSIZE=$(wc -c < /opt/crm/logs/api.err.log)
cat /opt/crm/logs/api.err.log
# what does FE runtime config expose?
curl -sS http://127.0.0.1:3000/login | tr '"' '\n' | grep -E 'api/v1|87.107|4000|apiBase' | head -20
"""
_, o, _ = c.exec_command(cmd, timeout=120)
p(o.read().decode("utf-8", "replace"))
c.close()

p("=== public ===")
for path in ["/api/v1/auth/panel-status", "/api/v1/auth/login"]:
    if path.endswith("login"):
        code, body, hdrs = http("POST", path, {"username": "saman", "password": "Saman@Crm2026!"})
    else:
        code, body, hdrs = http("GET", path)
    p(f"{path} -> {code} {body[:350]}")

# CORS preflight
req = urllib.request.Request(
    f"http://{HOST}/api/v1/auth/login",
    method="OPTIONS",
    headers={
        "Origin": f"http://{HOST}",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    },
)
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        p(f"OPTIONS login -> {r.status} ACAO={r.headers.get('Access-Control-Allow-Origin')}")
except urllib.error.HTTPError as e:
    p(f"OPTIONS login -> {e.code} ACAO={e.headers.get('Access-Control-Allow-Origin')} {e.read()[:100]}")
except Exception as e:
    p(f"OPTIONS login -> {e}")
