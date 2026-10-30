#!/usr/bin/env python3
"""Fix fullchain and enable HTTPS on VPS."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")
ROOT = Path(__file__).resolve().parents[1]
SSL_DIR = ROOT / "deploy" / "ssl"
NGINX_SRC = ROOT / "deploy" / "vps" / "nginx-kiaakala.conf"
REMOTE_SSL = "/opt/kiaakala/ssl"


def split_pem_blocks(text: str) -> list[str]:
    return [
        block.strip() + "\n"
        for block in re.findall(
            r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----",
            text,
            flags=re.S,
        )
    ]


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

    leaf = (SSL_DIR / "certificate.crt").read_text(encoding="utf-8")
    bundle_blocks = split_pem_blocks((SSL_DIR / "ca_bundle.crt").read_text(encoding="utf-8"))
    if not bundle_blocks:
        print("No CA certificates found", file=sys.stderr)
        return 1

    # nginx fullchain = domain cert + issuing intermediate (exclude root / broken blocks)
    fullchain = leaf.strip() + "\n" + bundle_blocks[0].strip() + "\n"
    intermediate_only = bundle_blocks[0].strip() + "\n"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)

    sftp = client.open_sftp()
    for remote_name, content, mode in (
        ("fullchain.pem", fullchain, 0o644),
        ("ca_intermediate.crt", intermediate_only, 0o644),
        ("private.key", (SSL_DIR / "private.key").read_text(encoding="utf-8"), 0o600),
    ):
        with sftp.file(f"{REMOTE_SSL}/{remote_name}", "w") as remote:
            remote.write(content.replace("\r\n", "\n"))
        sftp.chmod(f"{REMOTE_SSL}/{remote_name}", mode)
    with sftp.file("/etc/nginx/sites-available/kiaakala", "w") as remote:
        remote.write(NGINX_SRC.read_text(encoding="utf-8").replace("\r\n", "\n"))
    sftp.close()

    run(client, f"openssl x509 -noout -subject -in {REMOTE_SSL}/fullchain.pem")
    run(client, f"openssl verify -CAfile {REMOTE_SSL}/ca_intermediate.crt {REMOTE_SSL}/certificate.crt || true")
    run(client, "ln -sfn /etc/nginx/sites-available/kiaakala /etc/nginx/sites-enabled/kiaakala")
    run(client, "nginx -t")
    if run(client, "systemctl reload nginx") != 0:
        return 1
    run(client, "curl -sS -o /dev/null -w 'https:%{http_code}\\n' https://kiaakala.ir/")
    run(client, "curl -sS -o /dev/null -w 'api:%{http_code}\\n' https://kiaakala.ir/api/health")
    run(client, "curl -sS -o /dev/null -w 'redirect:%{http_code} loc:%{redirect_url}\\n' http://kiaakala.ir/")
    client.close()
    print("SSL_FIXED_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
