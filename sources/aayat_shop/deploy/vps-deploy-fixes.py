#!/usr/bin/env python3
"""Deploy frontend + backend fixes and enable SSL on VPS."""

import io
import tarfile
import time
from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"
ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend" / ".output" / "public"
BACKEND_DIST = ROOT / "backend" / "dist"
NGINX = ROOT / "deploy" / "vps" / "nginx-kiaakala.conf"
SCHEMA = ROOT / "backend" / "prisma" / "schema.prisma"
CORS = (
    "https://kiaakala.ir,https://www.kiaakala.ir,"
    "http://kiaakala.ir,http://www.kiaakala.ir,http://45.94.215.57"
)


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60, banner_timeout=60)
    transport = client.get_transport()
    if transport:
        transport.set_keepalive(15)
    return client


def run(client, cmd, timeout=300):
    print(f"\n$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip() and code != 0:
        print(err.rstrip())
    return code


def remote_size(client, remote: str) -> int:
    _, stdout, _ = client.exec_command(f"stat -c%s {remote} 2>/dev/null || echo 0")
    stdout.channel.recv_exit_status()
    try:
        return int(stdout.read().decode().strip() or "0")
    except ValueError:
        return 0


def upload_bytes(client, remote: str, data: bytes, retries: int = 6):
    part_size = 128 * 1024
    total = len(data)
    uploaded = 0

    while uploaded < total:
        part = data[uploaded : uploaded + part_size]
        tmp = f"{remote}.part"
        for attempt in range(1, retries + 1):
            try:
                sftp = client.open_sftp()
                with sftp.file(tmp, "wb") as f:
                    f.write(part)
                sftp.close()
                append = ">" if uploaded == 0 else ">>"
                run(client, f"cat {tmp} {append} {remote} && rm -f {tmp}")
                uploaded += len(part)
                print(f"Uploaded {remote}: {uploaded}/{total} bytes")
                break
            except Exception as exc:
                print(f"Upload part failed (attempt {attempt}): {exc}")
                try:
                    client.close()
                except Exception:
                    pass
                if attempt == retries:
                    raise
                time.sleep(3)
                client = connect()
                remote_size_val = remote_size(client, remote)
                uploaded = min(remote_size_val, total)
                if uploaded >= total:
                    print(f"Remote {remote} already complete ({uploaded} bytes)")
                    return client
                part = data[uploaded : uploaded + part_size]

    print(f"Uploaded {remote} ({total / 1024 / 1024:.1f} MB total)")
    return client


def make_tar(source: Path, arc_prefix: str) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        if source.is_dir():
            for path in source.rglob("*"):
                if path.is_file():
                    tar.add(str(path), arcname=str(Path(arc_prefix) / path.relative_to(source)))
        else:
            tar.add(str(source), arcname=arc_prefix)
    return buf.getvalue()


def upload_lf(client, local: Path, remote: str, retries: int = 4):
    data = local.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    for attempt in range(1, retries + 1):
        try:
            sftp = client.open_sftp()
            with sftp.file(remote, "w") as f:
                f.write(data)
            sftp.close()
            print(f"Uploaded {remote} ({len(data)} bytes)")
            return client
        except Exception as exc:
            print(f"Upload attempt {attempt} failed: {exc}")
            try:
                client.close()
            except Exception:
                pass
            if attempt == retries:
                raise
            time.sleep(2)
            client = connect()
    return client


def main() -> None:
    if not FRONTEND.exists():
        raise SystemExit("Frontend not built")
    if not BACKEND_DIST.exists():
        raise SystemExit("Backend not built")

    backend_tar = make_tar(BACKEND_DIST, "dist")
    frontend_tar = make_tar(FRONTEND, "frontend")
    print(f"Backend tar: {len(backend_tar)/1024/1024:.1f} MB")
    print(f"Frontend tar: {len(frontend_tar)/1024/1024:.1f} MB")

    client = connect()
    client = upload_bytes(client, "/tmp/backend-dist.tar.gz", backend_tar)
    client = upload_bytes(client, "/tmp/frontend-public.tar.gz", frontend_tar)
    client = upload_lf(client, NGINX, "/tmp/nginx-kiaakala.conf")

    run(client, "tar -xzf /tmp/backend-dist.tar.gz -C /opt/kiaakala/api")
    run(client, "rm -rf /var/www/kiaakala/* && mkdir -p /var/www/kiaakala")
    run(client, "tar -xzf /tmp/frontend-public.tar.gz -C /tmp && cp -a /tmp/frontend/. /var/www/kiaakala/ && chown -R www-data:www-data /var/www/kiaakala")
    run(client, "cp /tmp/nginx-kiaakala.conf /etc/nginx/sites-available/kiaakala && nginx -t && systemctl reload nginx")
    run(client, f"sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN={CORS}|' /opt/kiaakala/api/.env")
    if SCHEMA.exists():
        client = upload_lf(client, SCHEMA, "/opt/kiaakala/api/prisma/schema.prisma")
    run(client, "cd /opt/kiaakala/api && npx prisma db push --accept-data-loss")
    run(client, "pm2 restart kiaakala-api --update-env")
    run(
        client,
        "certbot --nginx -d kiaakala.ir -d www.kiaakala.ir "
        "--non-interactive --agree-tos -m admin@kiaakala.ir --redirect 2>&1 || true",
        timeout=180,
    )
    run(client, "nginx -t && systemctl reload nginx")
    run(client, "curl -sS http://127.0.0.1:3001/api/health")
    run(client, "curl -sS -o /dev/null -w 'http:%{http_code} ' http://127.0.0.1/api/health")
    run(client, "curl -sS -o /dev/null -w 'https:%{http_code}' https://kiaakala.ir/api/health 2>/dev/null || echo fail")
    run(client, "grep -o 'apiBase:\"[^\"]*\"' /var/www/kiaakala/index.html | head -1")
    client.close()
    print("\nDeploy complete.")


if __name__ == "__main__":
    main()
