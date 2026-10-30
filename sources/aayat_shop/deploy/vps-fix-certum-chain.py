#!/usr/bin/env python3
"""Diagnose and fix Certum chain; fallback to Let's Encrypt if needed."""

from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("VPS_HOST", "45.94.215.57")
USER = os.environ.get("VPS_USER", "root")
PASSWORD = os.environ.get("VPS_PASSWORD", "aGNinAcp6rc4sh0m")

REMOTE = r"""
set -e
SSL=/opt/kiaakala/ssl
cd "$SSL"

python3 - <<'PY'
from pathlib import Path
import subprocess

ssl = Path('/opt/kiaakala/ssl')
text = (ssl / 'ca_bundle.crt').read_text()
parts = [p.strip() for p in text.split('-----BEGIN CERTIFICATE-----') if p.strip()]
certs = ['-----BEGIN CERTIFICATE-----\n' + p if not p.startswith('-----') else p for p in parts]
for i, c in enumerate(certs):
    if not c.endswith('-----END CERTIFICATE-----\n'):
        c = c if c.endswith('-----END CERTIFICATE-----') else c + '\n-----END CERTIFICATE-----'
    path = ssl / f'chain-{i}.crt'
    path.write_text(c if c.endswith('\n') else c + '\n')
    r = subprocess.run(['openssl', 'x509', '-noout', '-subject', '-issuer', '-in', str(path)], capture_output=True, text=True)
    print(f'chain-{i}:', r.stdout.strip() or r.stderr.strip())

leaf = ssl / 'certificate.crt'
for i in range(len(certs)):
    chain = ssl / f'chain-{i}.crt'
    r = subprocess.run(['openssl', 'verify', '-CAfile', str(chain), str(leaf)], capture_output=True, text=True)
    print(f'verify leaf with chain-{i} only:', r.stdout.strip() or r.stderr.strip())

# build fullchain: leaf + first chain cert that verifies as untrusted with rest as CA
for i in range(len(certs)):
    ca = ssl / f'chain-{i}.crt'
    r = subprocess.run(['openssl', 'verify', '-CAfile', str(ca), str(leaf)], capture_output=True, text=True)
    if r.returncode == 0:
        full = (leaf.read_text().strip() + '\n' + ca.read_text().strip() + '\n')
        (ssl / 'fullchain.pem').write_text(full)
        print('FULLCHAIN_OK using chain-' + str(i))
        break
else:
    # try untrusted intermediate pattern
    if len(certs) >= 2:
        r = subprocess.run([
            'openssl', 'verify',
            '-CAfile', str(ssl / 'chain-1.crt'),
            '-untrusted', str(ssl / 'chain-0.crt'),
            str(leaf),
        ], capture_output=True, text=True)
        print('verify untrusted0 CA1:', r.stdout.strip() or r.stderr.strip())
        if r.returncode == 0:
            full = leaf.read_text().strip() + '\n' + (ssl / 'chain-0.crt').read_text().strip() + '\n'
            (ssl / 'fullchain.pem').write_text(full)
            print('FULLCHAIN_OK untrusted pattern')
PY

chmod 644 "$SSL/fullchain.pem" 2>/dev/null || true
nginx -t && systemctl reload nginx

if curl -sS -o /dev/null -w '%{http_code}' https://jetkala.shop/ 2>/dev/null | grep -q 200; then
  echo "HTTPS_VERIFY_OK"
else
  echo "HTTPS_VERIFY_FAIL -> restoring LetsEncrypt temporarily"
  sed -i 's|ssl_certificate /opt/kiaakala/ssl/fullchain.pem;|ssl_certificate /etc/letsencrypt/live/jetkala.shop/fullchain.pem;|' /etc/nginx/sites-available/jetkala
  sed -i 's|ssl_certificate_key /opt/kiaakala/ssl/private.key;|ssl_certificate_key /etc/letsencrypt/live/jetkala.shop/privkey.pem;|' /etc/nginx/sites-available/jetkala
  nginx -t && systemctl reload nginx
  curl -sS -o /dev/null -w 'letsencrypt:%{http_code}\n' https://jetkala.shop/
fi
openssl s_client -connect jetkala.shop:443 -servername jetkala.shop </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    _, stdout, stderr = client.exec_command(REMOTE, timeout=120)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print(err)
    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
