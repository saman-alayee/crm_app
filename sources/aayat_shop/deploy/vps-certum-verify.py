#!/usr/bin/env python3
"""Install Certum domain verification file and nginx .well-known routing."""

from __future__ import annotations

import os
import sys
import time

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")
LOCAL_FILE = os.environ.get(
    "CERTUM_FILE",
    r"C:\Users\Dart\Downloads\certum.txt",
)
REMOTE_DIR = "/opt/kiaakala/ssl/.well-known/pki-validation"
REMOTE_FILE = f"{REMOTE_DIR}/certum.txt"
NGINX_SRC = os.path.join(
    os.path.dirname(__file__),
    "vps",
    "nginx-kiaakala.conf",
)


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> int:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(f"$ {cmd}")
    if out:
        print(out, end="")
    if err:
        print(err, end="")
    print(f"exit={code}")
    return code


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    content = open(LOCAL_FILE, encoding="utf-8").read().strip()
    nginx_conf = open(NGINX_SRC, encoding="utf-8").read()

    print(f"Connecting to {HOST}...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=USER,
        password=PASSWORD,
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )

    run(client, f"mkdir -p {REMOTE_DIR}")

    sftp = client.open_sftp()
    with sftp.file(REMOTE_FILE, "w") as remote:
        remote.write(content + "\n")
    sftp.chmod(REMOTE_FILE, 0o644)
    with sftp.file("/etc/nginx/sites-available/kiaakala", "w") as remote:
        remote.write(nginx_conf.replace("\r\n", "\n"))
    sftp.close()

    run(client, "ln -sfn /etc/nginx/sites-available/kiaakala /etc/nginx/sites-enabled/kiaakala")
    run(client, "nginx -t")
    run(client, "systemctl reload nginx")

    run(
        client,
        "curl -s -o /dev/null -w 'local:%{http_code}\\n' "
        "http://127.0.0.1/.well-known/pki-validation/certum.txt",
    )
    run(client, "curl -s http://127.0.0.1/.well-known/pki-validation/certum.txt")
    run(
        client,
        "curl -s -o /dev/null -w 'public:%{http_code}\\n' "
        "http://kiaakala.ir/.well-known/pki-validation/certum.txt",
    )
    run(client, "curl -s http://kiaakala.ir/.well-known/pki-validation/certum.txt")

    client.close()
    print("CERTUM_VERIFY_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
