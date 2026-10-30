#!/usr/bin/env python3
"""Deploy supermarket app to VPS via SSH/SFTP."""

from __future__ import annotations

import io
import os
import sys
import tarfile
import textwrap
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "KiaaKala2026VpsSecure9")

BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
DEPLOY = ROOT / "deploy" / "vps"


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip(), file=sys.stderr)
    return code, out, err


def upload_text(sftp: paramiko.SFTPClient, remote: str, content: str) -> None:
    with sftp.file(remote, "w") as f:
        f.write(content)


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    if local.suffix in {".sh", ".conf"} or local.name.endswith(".sh"):
        content = local.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
        with sftp.file(remote, "w") as f:
            f.write(content)
        return
    sftp.put(str(local), remote)


def add_path(tar: tarfile.TarFile, src: Path, arc: str) -> None:
    if not src.exists():
        raise FileNotFoundError(src)
    tar.add(str(src), arcname=arc)


def build_env_content(db_pass: str) -> str:
    return textwrap.dedent(
        f"""\
        PORT=3001
        NODE_ENV=production
        DATABASE_URL="mysql://kiaakala:{db_pass}@localhost:3306/kiaakala"
        REDIS_DISABLED=true
        JWT_SECRET=kiaakala-hypermarket-prod-2026-x9Kp2mN8vQ4wR7tL
        JWT_EXPIRES_IN=7d
        OTP_EXPIRES_MINUTES=5
        OTP_DEV_MODE=false
        FARAZSMS_API_KEY=eCnzKQeW27Uky0ubGYomLOa5zH06hxdCGxKTCiOlauM0uPml2X
        FARAZSMS_PATTERN_CODE=ZKAFa6RmXD
        FARAZSMS_LINE_NUMBER=90008361
        FARAZSMS_NUMBER_FORMAT=english
        FARAZSMS_OTP_ATTRIBUTE=code
        UPLOAD_DIR=uploads
        MAX_FILE_SIZE=5242880
        CORS_ORIGIN=https://kiaakala.ir
        ADMIN_PHONE=09120000000
        ADMIN_PASSWORD=admin1234
        """
    )


def create_bundle() -> bytes:
    backend_dist = BACKEND / "dist"
    frontend_out = FRONTEND / ".output" / "public"
    if not backend_dist.exists():
        raise RuntimeError("Backend not built. Run: cd backend && npm run build")
    if not frontend_out.exists():
        raise RuntimeError("Frontend not built. Run: cd frontend && npm run build")

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in ["dist", "package.json", "package-lock.json", "prisma"]:
            add_path(tar, BACKEND / item, f"backend/{item}")

        for path in frontend_out.rglob("*"):
            if path.is_file():
                tar.add(str(path), arcname=str(Path("frontend") / path.relative_to(frontend_out)))

        add_path(tar, DEPLOY / "nginx-kiaakala.conf", "nginx-kiaakala.conf")
        add_path(tar, DEPLOY / "server-setup.sh", "server-setup.sh")

    return buf.getvalue()


def main() -> int:
    print("Creating deployment bundle...")
    bundle = create_bundle()
    print(f"Bundle size: {len(bundle) / 1024 / 1024:.1f} MB")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60)

    sftp = client.open_sftp()
    upload_file(sftp, DEPLOY / "nginx-kiaakala.conf", "/tmp/nginx-kiaakala.conf")
    upload_file(sftp, DEPLOY / "server-setup.sh", "/tmp/server-setup.sh")
    with sftp.file("/tmp/deploy-bundle.tar.gz", "wb") as f:
        f.write(bundle)
    sftp.close()

    run(client, "chmod +x /tmp/server-setup.sh")
    run(client, "mkdir -p /opt/kiaakala/api /var/www/kiaakala")
    code, _, _ = run(
        client,
        "tar -xzf /tmp/deploy-bundle.tar.gz -C /tmp && "
        "cp -a /tmp/backend/. /opt/kiaakala/api/ && "
        "rm -rf /var/www/kiaakala/* && "
        "cp -a /tmp/frontend/. /var/www/kiaakala/",
        timeout=120,
    )
    if code != 0:
        return code

    # Write .env after DB password exists (setup script creates it)
    run(client, "bash /tmp/server-setup.sh", timeout=900)

    # SSL if DNS already points here
    run(
        client,
        "certbot --nginx -d kiaakala.ir -d www.kiaakala.ir --non-interactive --agree-tos "
        "-m admin@kiaakala.ir --redirect 2>&1 || echo CERTBOT_SKIPPED",
        timeout=180,
    )

    print("\n=== Verification ===")
    for url in [
        "http://127.0.0.1:3001/api/health",
        "http://127.0.0.1/api/health",
        "http://127.0.0.1/api/categories",
    ]:
        run(client, f"curl -sS -o /dev/null -w '%{{http_code}}' {url} && echo ' {url}'")

    run(client, "curl -sS http://127.0.0.1/api/health | head -c 200; echo")
    run(client, "pm2 status")
    client.close()
    print("\nDeploy finished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
