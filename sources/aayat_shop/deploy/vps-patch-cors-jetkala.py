#!/usr/bin/env python3
"""Update CORS on VPS for jetkala.shop."""

import os
import sys
import time

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")

CORS = (
    "https://jetkala.shop,https://www.jetkala.shop,"
    "https://kiaakala.ir,https://www.kiaakala.ir,"
    "http://jetkala.shop,http://www.jetkala.shop,"
    "http://kiaakala.ir,http://www.kiaakala.ir,"
    "http://45.94.215.57"
)

REMOTE = f"""
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p = Path('/opt/kiaakala/api/.env')
lines = p.read_text(encoding='utf-8').splitlines()
out = []
seen = False
for ln in lines:
    if ln.startswith('CORS_ORIGIN='):
        out.append('CORS_ORIGIN={CORS}')
        seen = True
    else:
        out.append(ln)
if not seen:
    out.append('CORS_ORIGIN={CORS}')
p.write_text(chr(10).join(out) + chr(10), encoding='utf-8')
print('CORS_OK')
PY
pm2 restart kiaakala-api --update-env
sleep 2
grep CORS_ORIGIN /opt/kiaakala/api/.env
echo CORS_PATCH_OK
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=120)
    while True:
        if stdout.channel.recv_ready():
            print(stdout.channel.recv(65536).decode("utf-8", "replace"), end="", flush=True)
        if stderr.channel.recv_stderr_ready():
            print(stderr.channel.recv_stderr(65536).decode("utf-8", "replace"), end="", file=sys.stderr, flush=True)
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready() and not stderr.channel.recv_stderr_ready():
            break
        time.sleep(0.2)
    print(stdout.read().decode("utf-8", "replace"), end="")
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
