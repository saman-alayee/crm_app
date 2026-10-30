#!/usr/bin/env python3
"""Deploy address UI + schema updates to VPS (retry-safe uploads)."""

import io
import tarfile
import time
from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"
ROOT = Path(__file__).resolve().parents[1]


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60, banner_timeout=60)
    c.get_transport().set_keepalive(15)
    return c


def run(c, cmd, t=300):
    print("$", cmd[:120])
    _, o, e = c.exec_command(cmd, timeout=t)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip()[-2500:])
    if err.strip() and code != 0:
        print("ERR:", err.rstrip()[-1000:])
    return code


def upload_bytes(c, data: bytes, remote: str, retries=4):
    for attempt in range(retries):
        try:
            sftp = c.open_sftp()
            with sftp.file(remote, "wb") as f:
                step = 64 * 1024
                for i in range(0, len(data), step):
                    f.write(data[i : i + step])
            sftp.close()
            print(f"uploaded {remote} ({len(data)} bytes)")
            return c
        except Exception as exc:
            print(f"upload attempt {attempt + 1} failed: {exc}")
            try:
                c.close()
            except Exception:
                pass
            if attempt == retries - 1:
                raise
            time.sleep(2)
            c = connect()
    return c


def upload_file(c, local: Path, remote: str, retries=4):
    data = local.read_bytes()
    return upload_bytes(c, data, remote, retries)


def main():
    frontend = ROOT / "frontend" / ".output" / "public"
    if not frontend.exists():
        raise SystemExit("Run `npm run generate` in frontend first")

    backend_files = [
        (ROOT / "backend" / "dist" / "routes" / "address.routes.js", "/opt/kiaakala/api/dist/routes/address.routes.js"),
        (ROOT / "backend" / "dist" / "routes" / "order.routes.js", "/opt/kiaakala/api/dist/routes/order.routes.js"),
        (ROOT / "backend" / "dist" / "services" / "order.service.js", "/opt/kiaakala/api/dist/services/order.service.js"),
        (ROOT / "backend" / "dist" / "services" / "user.service.js", "/opt/kiaakala/api/dist/services/user.service.js"),
        (ROOT / "backend" / "prisma" / "schema.prisma", "/opt/kiaakala/api/prisma/schema.prisma"),
    ]

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in frontend.rglob("*"):
            if path.is_file():
                tar.add(str(path), arcname=str(path.relative_to(frontend)))
    frontend_tar = buf.getvalue()
    print(f"frontend tarball: {len(frontend_tar)} bytes")

    c = connect()

    for local, remote in backend_files:
        if not local.exists():
            raise SystemExit(f"Missing {local} — run backend build first")
        c = upload_file(c, local, remote)

    c = upload_bytes(c, frontend_tar, "/tmp/ui-fix-frontend.tar.gz")

    run(
        c,
        "mkdir -p /tmp/ui-frontend && tar -xzf /tmp/ui-fix-frontend.tar.gz -C /tmp/ui-frontend && "
        "rm -rf /var/www/kiaakala/* && cp -a /tmp/ui-frontend/. /var/www/kiaakala/ && "
        "chown -R www-data:www-data /var/www/kiaakala",
    )
    run(c, "cd /opt/kiaakala/api && npx prisma db push --accept-data-loss")
    run(c, "pm2 restart kiaakala-api --update-env")
    run(c, "curl -sS http://127.0.0.1:3001/api/health")
    c.close()
    print("Done")


if __name__ == "__main__":
    main()
