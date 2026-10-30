#!/usr/bin/env python3
"""Install Certum SSL certificate on the VPS."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")
ROOT = Path(__file__).resolve().parents[1]
SSL_DIR = ROOT / "deploy" / "ssl"
NGINX_SRC = ROOT / "deploy" / "vps" / "nginx-kiaakala.conf"
REMOTE_SSL = "/opt/kiaakala/ssl"
PRIVATE_KEY = Path(
    os.environ.get(
        "PRIVATE_KEY_FILE",
        os.environ.get("SSL_PRIVATE_KEY", str(SSL_DIR / "private.key")),
    )
)


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> int:
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    print(f"$ {cmd}")
    if out:
        print(out, end="")
    if err:
        print(err, end="")
    print(f"exit={code}")
    return code


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str, mode: int = 0o644) -> None:
    with sftp.file(remote, "w") as remote_file:
        remote_file.write(local.read_text(encoding="utf-8").replace("\r\n", "\n"))
    sftp.chmod(remote, mode)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    cert_file = SSL_DIR / "certificate.crt"
    bundle_file = SSL_DIR / "ca_bundle.crt"
    for path in (cert_file, bundle_file, NGINX_SRC):
        if not path.exists():
            print(f"Missing file: {path}", file=sys.stderr)
            return 1
    if not PRIVATE_KEY.exists():
        print(
            "Private key not found. Save it as deploy/ssl/private.key or set PRIVATE_KEY_FILE.",
            file=sys.stderr,
        )
        return 1

    print(f"Connecting to {HOST}...", flush=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=USER,
        password=PASSWORD,
        timeout=60,
        allow_agent=False,
        look_for_keys=False,
    )

    run(client, f"mkdir -p {REMOTE_SSL}/.well-known/pki-validation")
    run(client, "command -v openssl >/dev/null || apt-get update -y && apt-get install -y openssl")
    run(
        client,
        "[ -f /etc/letsencrypt/options-ssl-nginx.conf ] || "
        "(mkdir -p /etc/letsencrypt && certbot --version >/dev/null 2>&1 || "
        "apt-get install -y certbot) && "
        "certbot install --nginx --help >/dev/null 2>&1 || true",
        timeout=300,
    )

    sftp = client.open_sftp()
    upload_file(sftp, cert_file, f"{REMOTE_SSL}/certificate.crt")
    upload_file(sftp, bundle_file, f"{REMOTE_SSL}/ca_bundle.crt")
    upload_file(sftp, PRIVATE_KEY, f"{REMOTE_SSL}/private.key", mode=0o600)
    upload_file(sftp, NGINX_SRC, "/etc/nginx/sites-available/kiaakala")
    sftp.close()

    run(
        client,
        f"cat {REMOTE_SSL}/certificate.crt > {REMOTE_SSL}/fullchain.pem && "
        f"awk '/BEGIN CERTIFICATE/{{c++}} c==1{{print}}' {REMOTE_SSL}/ca_bundle.crt >> {REMOTE_SSL}/fullchain.pem",
    )
    run(client, f"chmod 600 {REMOTE_SSL}/private.key")
    run(
        client,
        f"openssl x509 -noout -modulus -in {REMOTE_SSL}/certificate.crt | openssl md5",
    )
    run(
        client,
        f"openssl rsa -noout -modulus -in {REMOTE_SSL}/private.key | openssl md5",
    )
    run(client, "ln -sfn /etc/nginx/sites-available/kiaakala /etc/nginx/sites-enabled/kiaakala")
    run(client, "nginx -t")
    run(client, "systemctl reload nginx")
    run(
        client,
        "python3 - <<'PY'\n"
        "from pathlib import Path\n"
        "p = Path('/opt/kiaakala/api/.env')\n"
        "lines = p.read_text(encoding='utf-8').splitlines()\n"
        "cors = (\n"
        "    'https://kiaakala.ir,https://www.kiaakala.ir,'\n"
        "    'http://kiaakala.ir,http://www.kiaakala.ir,http://45.94.215.57'\n"
        ")\n"
        "out = []\n"
        "seen = False\n"
        "for ln in lines:\n"
        "    if ln.startswith('CORS_ORIGIN='):\n"
        "        out.append('CORS_ORIGIN=' + cors)\n"
        "        seen = True\n"
        "    else:\n"
        "        out.append(ln)\n"
        "if not seen:\n"
        "    out.append('CORS_ORIGIN=' + cors)\n"
        "p.write_text('\\n'.join(out) + '\\n', encoding='utf-8')\n"
        "print('CORS_OK')\n"
        "PY",
    )
    run(client, "ufw allow 443/tcp >/dev/null 2>&1 || true")
    run(client, "pm2 restart kiaakala-api --update-env || true")
    run(client, "curl -sS -o /dev/null -w 'https:%{http_code}\\n' https://kiaakala.ir/")
    run(client, "curl -sS -o /dev/null -w 'api:%{http_code}\\n' https://kiaakala.ir/api/health")
    run(
        client,
        "curl -sS -o /dev/null -w 'redirect:%{http_code}\\n' http://kiaakala.ir/",
    )

    client.close()
    print("SSL_INSTALL_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
