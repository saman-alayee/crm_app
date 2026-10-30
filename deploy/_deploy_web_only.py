#!/usr/bin/env python3
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "dashboard" / ".output"


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def main() -> int:
    if not (OUT / "server" / "index.mjs").exists():
        p("missing .output")
        return 1
    tar_path = Path(tempfile.gettempdir()) / "crm-web-output.tgz"
    p(f"packing {OUT}")
    with tarfile.open(tar_path, "w:gz", compresslevel=3) as tar:
        tar.add(OUT, arcname=".output")
    p(f"size {tar_path.stat().st_size / 1e6:.1f} MB")

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        9011,
        username="root",
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = c.open_sftp()
    last = [0.0]

    def cb(a: int, b: int) -> None:
        now = time.time()
        if now - last[0] > 3 or a == b:
            p(f"  {100 * a / b:5.1f}%")
            last[0] = now

    sftp.put(str(tar_path), "/tmp/crm-web-output.tgz", callback=cb)
    sftp.close()

    cmd = r"""
set -e
systemctl stop crm-web
rm -rf /opt/crm/app/apps/dashboard/.output
tar -xzf /tmp/crm-web-output.tgz -C /opt/crm/app/apps/dashboard
chown -R crm:crm /opt/crm/app/apps/dashboard/.output
systemctl start crm-web
sleep 3
systemctl is-active crm-web
curl -fsS -o /dev/null -w 'web=%{http_code}\n' http://127.0.0.1:3000/
curl -fsS -o /dev/null -w 'proxy=%{http_code}\n' http://127.0.0.1/
curl -fsS -X POST http://127.0.0.1/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"saman","password":"Saman@Crm2026!"}' | head -c 120
echo
"""
    _, out, _ = c.exec_command(cmd, timeout=120, get_pty=True)
    while not out.channel.exit_status_ready():
        if out.channel.recv_ready():
            p(out.channel.recv(8192).decode("utf-8", "replace"))
        time.sleep(0.05)
    while out.channel.recv_ready():
        p(out.channel.recv(8192).decode("utf-8", "replace"))
    code = out.channel.recv_exit_status()
    c.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
