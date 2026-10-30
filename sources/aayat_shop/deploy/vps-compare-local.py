#!/usr/bin/env python3
"""Compare key VPS files with local repo."""

import hashlib
from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "aGNinAcp6rc4sh0m"
ROOT = Path(__file__).resolve().parents[1]

PAIRS = [
    ("backend/dist/index.js", "/opt/kiaakala/api/dist/index.js"),
    ("backend/prisma/schema.prisma", "/opt/kiaakala/api/prisma/schema.prisma"),
    ("backend/package.json", "/opt/kiaakala/api/package.json"),
    ("deploy/vps/nginx-kiaakala.conf", "/etc/nginx/sites-enabled/kiaakala"),
]


def sha_local(rel: str) -> str:
    path = ROOT / rel
    if not path.exists():
        return "MISSING"
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(HOST, username="root", password=PASSWORD, timeout=30)
    except Exception as exc:
        print(f"SSH_FAIL: {exc}")
        return 1

    def run(cmd: str) -> str:
        _, stdout, stderr = client.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", "replace").strip()
        err = stderr.read().decode("utf-8", "replace").strip()
        return out or err or "(empty)"

    print("=== VPS vs local checksums ===")
    diffs = []
    for local_rel, remote in PAIRS:
        remote_sha = run(f"sha256sum '{remote}' 2>/dev/null | awk '{{print $1}}'")
        if remote_sha in {"", "(empty)"}:
            remote_sha = "MISSING"
        local_sha = sha_local(local_rel)
        same = local_sha == remote_sha
        print(f"{local_rel}: {'SAME' if same else 'DIFF'}")
        if not same:
            diffs.append((local_rel, remote, local_sha, remote_sha))

    print("\n=== VPS metadata ===")
    for cmd in [
        "cd /opt/kiaakala/api && git rev-parse HEAD 2>/dev/null || echo NO_GIT",
        "pm2 describe kiaakala-api 2>/dev/null | grep -E 'status|restarts|uptime' || pm2 status kiaakala-api",
        "curl -sS http://127.0.0.1:3001/api/health",
        "stat -c '%y %s' /var/www/kiaakala/index.html 2>/dev/null || echo NO_FRONTEND",
    ]:
        print(">", cmd)
        print(run(cmd))
        print()

    if diffs:
        print("=== Differences found ===")
        for local_rel, remote, local_sha, remote_sha in diffs:
            print(f"- {local_rel} local={local_sha[:12]} remote={remote_sha[:12]}")
    else:
        print("No checksum differences on compared files.")

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
