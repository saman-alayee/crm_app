#!/usr/bin/env python3
"""Check / fix CRM VPS via SSH."""
from __future__ import annotations

import sys
import socket
import time

import paramiko

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
USER = "root"


def try_connect() -> paramiko.SSHClient | None:
    for port in (9011, 22):
        print(f"==== try SSH {HOST}:{port}")
        s = socket.socket()
        s.settimeout(8)
        try:
            r = s.connect_ex((HOST, port))
            print("tcp", r)
        finally:
            s.close()
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                HOST,
                port=port,
                username=USER,
                password=PASSWORD,
                timeout=30,
                banner_timeout=40,
                auth_timeout=30,
                allow_agent=False,
                look_for_keys=False,
            )
            print("SUCCESS on", port)
            return client
        except Exception as e:
            print(type(e).__name__, e)
    return None


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
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


def main() -> int:
    client = try_connect()
    if not client:
        print("NO_SSH")
        return 2

    run(
        client,
        r"""
set -e
echo HOST=$(hostname)
echo '--- /opt/crm ---'
ls -la /opt/crm 2>/dev/null || echo 'no /opt/crm'
echo '--- listeners ---'
ss -lntp 2>/dev/null | grep -E ':(80|3000|4000|9011|22) ' || true
echo '--- nginx ---'
systemctl is-active nginx 2>/dev/null || true
echo '--- pm2 ---'
sudo -u crm pm2 status 2>/dev/null || pm2 status 2>/dev/null || true
echo '--- local health ---'
curl -fsS --max-time 4 http://127.0.0.1:4000/api/v1/health || echo API_DOWN
curl -fsS -o /dev/null -w 'web=%{http_code}\n' --max-time 4 http://127.0.0.1:3000/ || echo WEB_DOWN
curl -fsS -o /dev/null -w 'proxy=%{http_code}\n' --max-time 4 http://127.0.0.1/ || echo PROXY_DOWN
echo '--- recent api err ---'
tail -n 40 /opt/crm/logs/api.err.log 2>/dev/null || true
echo '--- recent web err ---'
tail -n 40 /opt/crm/logs/web.err.log 2>/dev/null || true
""",
        timeout=60,
    )
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
