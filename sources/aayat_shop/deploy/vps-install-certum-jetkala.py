#!/usr/bin/env python3
"""Install Certum SSL certificate for jetkala.shop on the VPS."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")
ROOT = Path(__file__).resolve().parents[1]
SSL_DIR = ROOT / "deploy" / "ssl"
NGINX_SRC = ROOT / "deploy" / "vps" / "nginx-jetkala.conf"
REMOTE_SSL = "/opt/kiaakala/ssl"

CERT_FILE = SSL_DIR / "certificate.crt"
BUNDLE_FILE = SSL_DIR / "ca_bundle.crt"
KEY_FILE = SSL_DIR / "private.key"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> int:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(f"$ {cmd[:100]}...")
    if out:
        print(out, end="")
    if err:
        print(err, end="")
    print(f"exit={code}")
    return code


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str, mode: int = 0o644) -> None:
    with sftp.file(remote, "w") as remote_file:
        remote_file.write(local.read_text(encoding="utf-8").replace("\r\n", "\n").strip() + "\n")
    sftp.chmod(remote, mode)


def patch_nginx_for_certum(conf: str) -> str:
    return conf.replace(
        "ssl_certificate /etc/letsencrypt/live/jetkala.shop/fullchain.pem;\n"
        "    ssl_certificate_key /etc/letsencrypt/live/jetkala.shop/privkey.pem;",
        "ssl_certificate /opt/kiaakala/ssl/fullchain.pem;\n"
        "    ssl_certificate_key /opt/kiaakala/ssl/private.key;",
    )


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    for path in (CERT_FILE, BUNDLE_FILE, KEY_FILE, NGINX_SRC):
        if not path.exists():
            print(f"Missing file: {path}", file=sys.stderr)
            return 1

    nginx_conf = patch_nginx_for_certum(NGINX_SRC.read_text(encoding="utf-8"))

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

    run(client, f"mkdir -p {REMOTE_SSL}/.well-known/pki-validation")
    run(client, "command -v openssl >/dev/null || apt-get update -y && apt-get install -y openssl")

    # Preserve old kiaakala cert for legacy redirect if present
    run(
        client,
        f"test -f {REMOTE_SSL}/fullchain.pem && cp -a {REMOTE_SSL}/fullchain.pem {REMOTE_SSL}/kiaakala-legacy-fullchain.pem || true",
    )
    run(
        client,
        f"test -f {REMOTE_SSL}/private.key && cp -a {REMOTE_SSL}/private.key {REMOTE_SSL}/kiaakala-legacy-private.key || true",
    )

    sftp = client.open_sftp()
    upload_file(sftp, CERT_FILE, f"{REMOTE_SSL}/certificate.crt")
    upload_file(sftp, BUNDLE_FILE, f"{REMOTE_SSL}/ca_bundle.crt")
    upload_file(sftp, KEY_FILE, f"{REMOTE_SSL}/private.key", mode=0o600)
    with sftp.file("/etc/nginx/sites-available/jetkala", "w") as remote:
        remote.write(nginx_conf.replace("\r\n", "\n"))
    sftp.close()

    run(
        client,
        f"cat {REMOTE_SSL}/certificate.crt {REMOTE_SSL}/ca_bundle.crt > {REMOTE_SSL}/fullchain.pem",
    )
    run(client, f"chmod 600 {REMOTE_SSL}/private.key")
    run(client, f"chmod 644 {REMOTE_SSL}/fullchain.pem")
    run(client, f"openssl x509 -noout -subject -dates -in {REMOTE_SSL}/certificate.crt")
    run(
        client,
        f"openssl x509 -noout -modulus -in {REMOTE_SSL}/certificate.crt | openssl md5",
    )
    run(
        client,
        f"openssl rsa -noout -modulus -in {REMOTE_SSL}/private.key 2>/dev/null | openssl md5",
    )
    run(client, "ln -sfn /etc/nginx/sites-available/jetkala /etc/nginx/sites-enabled/jetkala")
    run(client, "nginx -t")
    run(client, "systemctl reload nginx")
    run(client, "curl -sS -o /dev/null -w 'https_jet:%{http_code}\\n' https://jetkala.shop/")
    run(client, "curl -sS -o /dev/null -w 'api:%{http_code}\\n' https://jetkala.shop/api/health")
    run(
        client,
        f"openssl s_client -connect jetkala.shop:443 -servername jetkala.shop </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates",
        timeout=30,
    )

    client.close()
    print("CERTUM_SSL_INSTALL_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
