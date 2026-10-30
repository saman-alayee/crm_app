#!/usr/bin/env python3
"""Patch CORS config on VPS and restart API."""

import io
import tarfile
from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"
ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "backend" / "dist"
CORS = "https://kiaakala.ir,https://www.kiaakala.ir,http://45.94.215.57"


def main() -> None:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(str(DIST), arcname="dist")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)

    sftp = client.open_sftp()
    with sftp.file("/tmp/dist-patch.tar.gz", "wb") as f:
        f.write(buf.getvalue())
    sftp.close()

    cmds = [
        "tar -xzf /tmp/dist-patch.tar.gz -C /opt/kiaakala/api",
        f"sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN={CORS}|' /opt/kiaakala/api/.env",
        "pm2 restart kiaakala-api",
        "sleep 2",
        'curl -sS -D - -o /dev/null -H "Origin: https://www.kiaakala.ir" http://127.0.0.1:3001/api/health | grep -i access-control',
    ]
    for cmd in cmds:
        print(f"$ {cmd}")
        _, stdout, stderr = client.exec_command(cmd, timeout=120)
        out = stdout.read().decode("utf-8", "replace")
        err = stderr.read().decode("utf-8", "replace")
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print(err.rstrip())

    client.close()
    print("CORS patch applied.")


if __name__ == "__main__":
    main()
