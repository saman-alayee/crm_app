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
PRISMA_CLIENT = ROOT / "node_modules" / ".prisma" / "client"


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def main() -> int:
    if not (PRISMA_CLIENT / "libquery_engine-debian-openssl-3.0.x.so.node").exists():
        p("missing linux engine")
        return 1
    tar_path = Path(tempfile.gettempdir()) / "prisma-client-linux.tgz"
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(PRISMA_CLIENT, arcname="client")
    p(f"packed {tar_path.stat().st_size / 1e6:.1f} MB")

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
    p("upload...")
    sftp.put(str(tar_path), "/tmp/prisma-client-linux.tgz")
    sftp.close()

    cmd = r"""
set -e
for dest in /opt/crm/app/node_modules/.prisma /opt/crm/app/apps/api/node_modules/.prisma; do
  mkdir -p "$dest"
  rm -rf "$dest/client"
  tar -xzf /tmp/prisma-client-linux.tgz -C "$dest"
done
chown -R crm:crm /opt/crm/app/node_modules/.prisma /opt/crm/app/apps/api/node_modules/.prisma
ls -la /opt/crm/app/apps/api/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node
systemctl restart crm-api
sleep 5
systemctl --no-pager status crm-api | head -20
curl -fsS --max-time 8 http://127.0.0.1:4000/api/v1/health || echo API_FAIL
echo
curl -fsS --max-time 8 http://127.0.0.1/api/v1/health || echo PROXY_API_FAIL
echo
curl -fsS -o /dev/null -w 'web=%{http_code}\n' --max-time 8 http://127.0.0.1/
tail -n 20 /opt/crm/logs/api.err.log 2>/dev/null || true
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
