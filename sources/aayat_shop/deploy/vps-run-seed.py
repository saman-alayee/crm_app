#!/usr/bin/env python3
"""Upload seed.ts and run database seed on VPS."""

from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"
ROOT = Path(__file__).resolve().parents[1]
SEED = ROOT / "backend" / "prisma" / "seed.ts"
CONFIG = ROOT / "backend" / "src" / "config" / "index.ts"


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60, banner_timeout=60)
    c.get_transport().set_keepalive(15)
    return c


def run(c, cmd, t=300):
    print("$", cmd[:140])
    _, o, e = c.exec_command(cmd, timeout=t)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip()[-3000:])
    if err.strip() and code != 0:
        print("ERR:", err.rstrip()[-1500:])
    return code


def upload_text(c, local: Path, remote: str) -> None:
    data = local.read_text(encoding="utf-8").replace("\r\n", "\n")
    sftp = c.open_sftp()
    with sftp.file(remote, "w") as f:
        f.write(data)
    sftp.close()


def main() -> None:
    c = connect()
    run(c, "mkdir -p /opt/kiaakala/api/src/config")
    upload_text(c, SEED, "/opt/kiaakala/api/prisma/seed.ts")
    upload_text(c, CONFIG, "/opt/kiaakala/api/src/config/index.ts")

    cmds = [
        "cd /opt/kiaakala/api && npm install --no-save tsx typescript @types/node 2>&1 | tail -3",
        "cd /opt/kiaakala/api && npx tsx prisma/seed.ts",
        "curl -sS http://127.0.0.1:3001/api/categories | head -c 200",
        "curl -sS 'http://127.0.0.1:3001/api/products?limit=3' | head -c 300",
    ]
    for cmd in cmds:
        code = run(c, cmd, 300)
        if code != 0 and "seed.ts" in cmd:
            raise SystemExit(code)
    c.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
