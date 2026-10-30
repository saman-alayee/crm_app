#!/usr/bin/env python3
"""Quick check of jetkala.shop nginx/CORS state on VPS."""

import os
import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")

CMDS = [
    "ls -la /etc/nginx/sites-enabled/",
    "nginx -t 2>&1",
    'curl -sS -o /dev/null -w "ip:%{http_code}\\n" -H "Host: jetkala.shop" http://127.0.0.1/',
    "grep CORS_ORIGIN /opt/kiaakala/api/.env || true",
    "pm2 status",
    "test -f /etc/letsencrypt/live/jetkala.shop/fullchain.pem && echo SSL_OK || echo SSL_MISSING",
]


def main() -> None:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    for cmd in CMDS:
        print(f">>> {cmd}")
        _, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        if out:
            print(out, end="")
        if err:
            print(err, end="")
    client.close()


if __name__ == "__main__":
    main()
