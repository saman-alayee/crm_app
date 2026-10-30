#!/usr/bin/env python3
"""Deploy/update CRM on VPS over SSH (HTTP only, no SSL)."""
from __future__ import annotations

import sys
import time

import paramiko

HOST = "87.107.54.193"
PORT = 9011
USER = "root"
PASSWORD = "JFbkq4img1"


def connect() -> paramiko.SSHClient:
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        port=PORT,
        username=USER,
        password=PASSWORD,
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    return c


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:200]}{'...' if len(cmd) > 200 else ''}", flush=True)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=True)
    out_chunks: list[str] = []
    err_chunks: list[str] = []
    # stream stdout
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            chunk = stdout.channel.recv(4096).decode("utf-8", "replace")
            out_chunks.append(chunk)
            print(chunk, end="", flush=True)
        if stderr.channel.recv_stderr_ready():
            chunk = stderr.channel.recv_stderr(4096).decode("utf-8", "replace")
            err_chunks.append(chunk)
            print(chunk, end="", flush=True)
        time.sleep(0.05)
    # drain remaining
    while stdout.channel.recv_ready():
        chunk = stdout.channel.recv(4096).decode("utf-8", "replace")
        out_chunks.append(chunk)
        print(chunk, end="", flush=True)
    while stderr.channel.recv_stderr_ready():
        chunk = stderr.channel.recv_stderr(4096).decode("utf-8", "replace")
        err_chunks.append(chunk)
        print(chunk, end="", flush=True)
    code = stdout.channel.recv_exit_status()
    return code, "".join(out_chunks), "".join(err_chunks)


def main() -> int:
    client = connect()
    print("SSH OK")

    code, out, _ = run(
        client,
        r"""
set +e
echo '=== BEFORE ==='
hostname
ls -la /opt/crm 2>/dev/null || echo 'no /opt/crm yet'
sudo -u crm pm2 status 2>/dev/null || pm2 status 2>/dev/null || true
ss -lntp 2>/dev/null | grep -E ':(80|3000|4000) ' || true
curl -fsS --max-time 3 http://127.0.0.1:4000/api/v1/health || echo API_DOWN
curl -fsS -o /dev/null -w 'web=%{http_code}\n' --max-time 3 http://127.0.0.1:3000/ || echo WEB_DOWN
""",
        timeout=60,
    )

    # Download and run fix-stack (full install/update + build + nginx + pm2)
    code, out, err = run(
        client,
        r"""
set -e
export DEBIAN_FRONTEND=noninteractive
export PUBLIC_HOST=87.107.54.193
export ADMIN_SAMAN_PASSWORD='Saman@Crm2026!'
curl -fsSL https://raw.githubusercontent.com/saman-alayee/crm_app/main/deploy/fix-stack.sh -o /tmp/crm-fix.sh
bash /tmp/crm-fix.sh
""",
        timeout=2400,
    )

    print("\n=== fix-stack exit:", code)
    if code != 0:
        print("fix-stack failed; trying server-setup fallback...")
        code2, _, _ = run(
            client,
            r"""
set -e
export DEBIAN_FRONTEND=noninteractive
export PUBLIC_HOST=87.107.54.193
export ADMIN_SAMAN_PASSWORD='Saman@Crm2026!'
curl -fsSL https://raw.githubusercontent.com/saman-alayee/crm_app/main/deploy/server-setup.sh -o /tmp/crm-setup.sh
bash /tmp/crm-setup.sh
""",
            timeout=2400,
        )
        print("server-setup exit:", code2)
        code = code2

    run(
        client,
        r"""
set +e
echo '=== AFTER ==='
sudo -u crm pm2 status 2>/dev/null || pm2 status
ss -lntp | grep -E ':(80|3000|4000) ' || true
curl -fsS --max-time 5 http://127.0.0.1:4000/api/v1/health; echo
curl -fsS -o /dev/null -w 'web=%{http_code}\n' --max-time 5 http://127.0.0.1:3000/
curl -fsS -o /dev/null -w 'proxy=%{http_code}\n' --max-time 5 http://127.0.0.1/
test -f /opt/crm/ADMIN_SAMAN.txt && echo -n 'saman pass file: ' && cat /opt/crm/ADMIN_SAMAN.txt && echo
test -f /opt/crm/CREDENTIALS.txt && echo -n 'owner pass file: ' && cat /opt/crm/CREDENTIALS.txt && echo
tail -n 25 /opt/crm/logs/api.err.log 2>/dev/null || true
tail -n 25 /opt/crm/logs/web.err.log 2>/dev/null || true
""",
        timeout=60,
    )

    client.close()
    return 0 if code == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
