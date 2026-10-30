#!/usr/bin/env python3
"""Upload Certum domain verification file for jetkala.shop."""

from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")
CONTENT = os.environ.get(
    "CERTUM_CONTENT",
    "c1b6b4e15e1a5b629bbdf2f12ecf27340e9ce14117e0343603201ffac27f0c8-certum.pl",
)
WEB_DIR = "/var/www/kiaakala/.well-known/pki-validation"
SSL_DIR = "/opt/kiaakala/ssl/.well-known/pki-validation"
NGINX_SRC = os.path.join(os.path.dirname(__file__), "vps", "nginx-jetkala.conf")


def write_file(sftp: paramiko.SFTPClient, path: str, content: str) -> None:
    with sftp.file(path, "w") as remote:
        remote.write(content.strip() + "\n")
    sftp.chmod(path, 0o644)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    content = CONTENT.strip()
    nginx_conf = open(NGINX_SRC, encoding="utf-8").read()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)

    for d in (WEB_DIR, SSL_DIR):
        client.exec_command(f"mkdir -p {d}")[1].channel.recv_exit_status()

    sftp = client.open_sftp()
    write_file(sftp, f"{WEB_DIR}/certum.txt", content)
    write_file(sftp, f"{SSL_DIR}/certum.txt", content)
    with sftp.file("/etc/nginx/sites-available/jetkala", "w") as remote:
        remote.write(nginx_conf.replace("\r\n", "\n"))
    sftp.close()

    cmds = [
        "chown -R www-data:www-data /var/www/kiaakala/.well-known",
        "ln -sfn /etc/nginx/sites-available/jetkala /etc/nginx/sites-enabled/jetkala",
        "nginx -t && systemctl reload nginx",
        "curl -s -o /dev/null -w 'http:%{http_code}\\n' http://jetkala.shop/.well-known/pki-validation/certum.txt",
        "curl -s http://jetkala.shop/.well-known/pki-validation/certum.txt",
        "curl -s -o /dev/null -w 'https:%{http_code}\\n' https://jetkala.shop/.well-known/pki-validation/certum.txt",
        "curl -s https://jetkala.shop/.well-known/pki-validation/certum.txt",
    ]
    for cmd in cmds:
        print(f">>> {cmd}")
        _, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        if out:
            print(out, end="")
        if err:
            print(err, end="")

    client.close()
    print("CERTUM_VERIFY_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
