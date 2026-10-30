#!/usr/bin/env python3
"""Upload Certum certificate files to VPS (without enabling HTTPS yet)."""

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
REMOTE_SSL = "/opt/kiaakala/ssl"


def run(client: paramiko.SSHClient, cmd: str) -> int:
    _, stdout, stderr = client.exec_command(cmd, timeout=120)
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
    cert_file = SSL_DIR / "certificate.crt"
    bundle_file = SSL_DIR / "ca_bundle.crt"
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    run(client, f"mkdir -p {REMOTE_SSL}")
    sftp = client.open_sftp()
    for local, name in ((cert_file, "certificate.crt"), (bundle_file, "ca_bundle.crt")):
        with sftp.file(f"{REMOTE_SSL}/{name}", "w") as remote:
            remote.write(local.read_text(encoding="utf-8").replace("\r\n", "\n"))
    sftp.close()
    run(client, f"cat {REMOTE_SSL}/certificate.crt {REMOTE_SSL}/ca_bundle.crt > {REMOTE_SSL}/fullchain.pem")
    run(client, f"openssl x509 -noout -subject -dates -in {REMOTE_SSL}/certificate.crt")
    run(client, f"test -f {REMOTE_SSL}/private.key && echo HAS_KEY || echo NEED_KEY")
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
