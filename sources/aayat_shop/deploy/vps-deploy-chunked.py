#!/usr/bin/env python3
"""Chunked VPS deploy: file-by-file frontend + backend patches."""

import sys
import time
from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"
ROOT = Path(__file__).resolve().parents[1]


def log(msg: str):
    text = str(msg)
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("utf-8", errors="replace").decode("utf-8", errors="replace"), flush=True)


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60, banner_timeout=60)
    c.get_transport().set_keepalive(10)
    return c


def run(c, cmd, t=300):
    log(f"$ {cmd[:100]}")
    _, o, e = c.exec_command(cmd, timeout=t)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        log(out.rstrip()[-2000:])
    if err.strip() and code != 0:
        log(f"ERR: {err.rstrip()[-800:]}")
    return code, c


def put_file(c, local: Path, remote: str, retries=5):
    data = local.read_bytes()
    remote_dir = str(Path(remote).parent).replace("\\", "/")
    run(c, f"mkdir -p '{remote_dir}'")[0]

    for attempt in range(retries):
        try:
            sftp = c.open_sftp()
            with sftp.file(remote, "wb") as f:
                step = 32 * 1024
                for i in range(0, len(data), step):
                    f.write(data[i : i + step])
            sftp.close()
            log(f"  ok {local.name} -> {remote} ({len(data)}b)")
            return c
        except Exception as exc:
            log(f"  retry {attempt + 1}/{retries} {local.name}: {exc}")
            try:
                c.close()
            except Exception:
                pass
            if attempt == retries - 1:
                raise
            time.sleep(2)
            c = connect()
    return c


def main():
    frontend = ROOT / "frontend" / ".output" / "public"
    backend_dist = ROOT / "backend" / "dist"
    if not frontend.exists():
        log("Missing frontend build — run npm run generate")
        sys.exit(1)
    if not backend_dist.exists():
        log("Missing backend build — run npm run build")
        sys.exit(1)

    backend_files = [
        (ROOT / "backend" / "prisma" / "schema.prisma", "/opt/kiaakala/api/prisma/schema.prisma"),
        (ROOT / "backend" / "prisma" / "seed.ts", "/opt/kiaakala/api/prisma/seed.ts"),
    ]
    for path in sorted(backend_dist.rglob("*")):
        if path.is_file():
            rel = path.relative_to(backend_dist).as_posix()
            backend_files.append((path, f"/opt/kiaakala/api/dist/{rel}"))

    files = sorted(p for p in frontend.rglob("*") if p.is_file())
    log(f"Deploying {len(files)} frontend files + {len(backend_files)} backend files")

    c = connect()

    for local, remote in backend_files:
        if not local.exists():
            log(f"Missing {local}")
            sys.exit(1)
        c = put_file(c, local, remote)

    run(c, "find /var/www/kiaakala -mindepth 1 -delete")[0]

    for i, path in enumerate(files, 1):
        rel = path.relative_to(frontend).as_posix()
        remote = f"/var/www/kiaakala/{rel}"
        c = put_file(c, path, remote)
        if i % 20 == 0:
            log(f"  progress {i}/{len(files)}")

    run(c, "chown -R www-data:www-data /var/www/kiaakala")
    run(c, "cd /opt/kiaakala/api && npx prisma generate")
    run(c, "cd /opt/kiaakala/api && npx prisma db push --accept-data-loss")
    run(c, "cd /opt/kiaakala/api && npx tsx prisma/seed.ts 2>&1 || echo SEED_SKIPPED")
    run(c, "pm2 restart kiaakala-api --update-env")
    run(c, "curl -sS http://127.0.0.1:3001/api/health")
    c.close()
    log("Done")


if __name__ == "__main__":
    main()
