#!/usr/bin/env python3
import paramiko
from pathlib import Path

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"
ROOT = Path(__file__).resolve().parent / "vps"


def run(client, cmd, timeout=900):
    print(f"\n$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print(err.rstrip())
    return code, out, err


def upload_lf(sftp, local: Path, remote: str) -> None:
    data = local.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    with sftp.file(remote, "w") as f:
        f.write(data)


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=60)

    sftp = client.open_sftp()
    upload_lf(sftp, ROOT / "server-setup.sh", "/tmp/server-setup.sh")
    upload_lf(sftp, ROOT / "nginx-kiaakala.conf", "/tmp/nginx-kiaakala.conf")
    sftp.close()

    run(client, "chmod +x /tmp/server-setup.sh")
    code, _, _ = run(client, "bash /tmp/server-setup.sh", timeout=900)
    if code != 0:
        return code

    run(
        client,
        "certbot --nginx -d kiaakala.ir -d www.kiaakala.ir "
        "--non-interactive --agree-tos -m admin@kiaakala.ir --redirect 2>&1 || true",
        timeout=180,
    )

    for cmd in [
        "pm2 status",
        "curl -sS http://127.0.0.1:3001/api/health",
        "curl -sS http://127.0.0.1/api/categories | head -c 400",
        'curl -sS -o /dev/null -w "ip:%{http_code}" http://45.94.215.57/api/health',
        'curl -sS -o /dev/null -w "domain:%{http_code}" http://kiaakala.ir/api/health || true',
    ]:
        run(client, cmd)

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
