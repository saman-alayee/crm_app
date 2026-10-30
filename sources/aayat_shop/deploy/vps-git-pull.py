#!/usr/bin/env python3
"""Pull latest main on the VPS and run the production build script."""

from __future__ import annotations

import os
import sys
import time

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")
REPO = "https://github.com/saman-alayee/supermarket.git"
REPO_DIR = "/opt/kiaakala/src"

REMOTE = rf"""
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if ! command -v git >/dev/null 2>&1; then apt-get update -y && apt-get install -y git; fi
mkdir -p /opt/kiaakala
if [ -d {REPO_DIR}/.git ]; then
  cd {REPO_DIR}
  git remote set-url origin {REPO}
  git fetch origin main
  git reset --hard origin/main
else
  rm -rf {REPO_DIR}
  git clone --branch main {REPO} {REPO_DIR}
fi
cd {REPO_DIR}
git log -1 --oneline
chmod +x deploy/vps/remote-pull-build.sh
bash deploy/vps/remote-pull-build.sh
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    print(f"Connecting to {HOST}...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    transport = client.get_transport()
    if transport:
        transport.set_keepalive(15)
    print("Connected. Pulling and building on VPS...", flush=True)

    _, stdout, stderr = client.exec_command(REMOTE, timeout=3600)
    while True:
        if stdout.channel.recv_ready():
            print(stdout.channel.recv(65536).decode("utf-8", "replace"), end="", flush=True)
        if stderr.channel.recv_stderr_ready():
            print(stderr.channel.recv_stderr(65536).decode("utf-8", "replace"), end="", file=sys.stderr, flush=True)
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready() and not stderr.channel.recv_stderr_ready():
            break
        time.sleep(0.2)
    leftover = stdout.read().decode("utf-8", "replace")
    leftover_err = stderr.read().decode("utf-8", "replace")
    if leftover:
        print(leftover, end="", flush=True)
    if leftover_err:
        print(leftover_err, end="", file=sys.stderr, flush=True)
    code = stdout.channel.recv_exit_status()
    client.close()
    if code != 0:
        print("Remote deploy failed", file=sys.stderr)
        return code
    print("\nRemote deploy finished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
