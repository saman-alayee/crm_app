#!/usr/bin/env python3
"""Inspect VPS files and sync server-only changes to local."""

import hashlib
import sys
from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "aGNinAcp6rc4sh0m"
ROOT = Path(__file__).resolve().parents[1]

# Source files worth comparing (not compiled dist)
SOURCE_FILES = [
    "backend/prisma/schema.prisma",
    "backend/prisma/seed.ts",
    "backend/src/index.ts",
    "backend/package.json",
    "backend/.env",
    "deploy/vps/nginx-kiaakala.conf",
    "frontend/nuxt.config.ts",
]


def log(msg: str) -> None:
    text = str(msg)
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("utf-8", errors="replace").decode("utf-8", errors="replace"), flush=True)


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30)
    sftp = client.open_sftp()

    def run(cmd: str) -> str:
        _, stdout, stderr = client.exec_command(cmd, timeout=60)
        out = stdout.read().decode("utf-8", "replace").strip()
        err = stderr.read().decode("utf-8", "replace").strip()
        return out or err

    remote_map = {
        "backend/prisma/schema.prisma": "/opt/kiaakala/api/prisma/schema.prisma",
        "backend/prisma/seed.ts": "/opt/kiaakala/api/prisma/seed.ts",
        "backend/src/index.ts": "/opt/kiaakala/api/src/index.ts",
        "backend/package.json": "/opt/kiaakala/api/package.json",
        "backend/.env": "/opt/kiaakala/api/.env",
        "deploy/vps/nginx-kiaakala.conf": "/etc/nginx/sites-enabled/kiaakala",
        "frontend/nuxt.config.ts": None,
    }

    log("=== Server metadata ===")
    for cmd in [
        "date -Is",
        "pm2 jlist 2>/dev/null | head -c 400 || pm2 status",
        "curl -sS http://127.0.0.1:3001/api/health",
        "stat -c '%y %s' /var/www/kiaakala/index.html 2>/dev/null",
        "ls -la /opt/kiaakala/api/src/index.ts 2>/dev/null || echo NO_SRC",
        "ls -la /opt/kiaakala/api/dist/index.js 2>/dev/null | awk '{print $6,$7,$8,$9}'",
    ]:
        log(f"> {cmd}")
        log(run(cmd))
        log("")

    log("=== Source file comparison ===")
    to_download: list[tuple[str, str]] = []

    for local_rel, remote in remote_map.items():
        local_path = ROOT / local_rel
        if not remote:
            continue
        try:
            with sftp.file(remote, "rb") as f:
                remote_data = f.read()
        except FileNotFoundError:
            log(f"{local_rel}: remote MISSING")
            continue

        remote_sha = sha_bytes(remote_data)
        if local_path.exists():
            local_sha = sha_bytes(local_path.read_bytes())
            status = "SAME" if local_sha == remote_sha else "DIFF"
        else:
            status = "LOCAL_MISSING"
        log(f"{local_rel}: {status}")
        if status != "SAME":
            to_download.append((local_rel, remote))

    # Compare a few frontend built asset timestamps
    log("=== Frontend on server ===")
    log(run("find /var/www/kiaakala -maxdepth 2 -type f | head -20"))

    if not to_download:
        log("No server diffs to apply for tracked source files.")
        sftp.close()
        client.close()
        return 0

    log("\n=== Downloading server versions to local ===")
    for local_rel, remote in to_download:
        local_path = ROOT / local_rel
        local_path.parent.mkdir(parents=True, exist_ok=True)
        backup = local_path.with_suffix(local_path.suffix + ".local-backup")
        if local_path.exists() and not backup.exists():
            backup.write_bytes(local_path.read_bytes())
        with sftp.file(remote, "rb") as f:
            data = f.read()
        local_path.write_bytes(data)
        log(f"updated {local_rel} ({len(data)} bytes)")

    sftp.close()
    client.close()
    log("Done.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"ERROR: {exc}")
        raise
