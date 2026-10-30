#!/usr/bin/env python3
"""Ensure ADMIN_PHONES and admin user exist on VPS."""

from __future__ import annotations

import sys
import time

import paramiko

HOST = "45.94.215.57"
USER = "root"
PASSWORD = "aGNinAcp6rc4sh0m"

REMOTE = r"""
set -euo pipefail
ENV=/opt/kiaakala/api/.env
if grep -q '^ADMIN_PHONES=' "$ENV"; then
  sed -i 's/^ADMIN_PHONES=.*/ADMIN_PHONES=09051770091/' "$ENV"
else
  printf '\nADMIN_PHONES=09051770091\n' >> "$ENV"
fi
cd /opt/kiaakala/api
node <<'NODE'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const u = await prisma.user.upsert({
    where: { phone: '09051770091' },
    update: { role: 'ADMIN', firstName: 'مدیر', lastName: 'KIAA KALA', isActive: true },
    create: { phone: '09051770091', role: 'ADMIN', firstName: 'مدیر', lastName: 'KIAA KALA' },
  });
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { phone: true, isActive: true },
    orderBy: { phone: 'asc' },
  });
  console.log('ADMIN_OK', u.phone, u.role);
  console.log('ADMINS', JSON.stringify(admins));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
pm2 restart kiaakala-api --update-env
grep -E '^(ADMIN_PHONE|ADMIN_PHONES)=' "$ENV"
"""


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=60, allow_agent=False, look_for_keys=False)
    transport = client.get_transport()
    if transport:
        transport.set_keepalive(15)

    _, stdout, stderr = client.exec_command(REMOTE, timeout=180)
    while True:
        if stdout.channel.recv_ready():
            print(stdout.channel.recv(65536).decode("utf-8", "replace"), end="", flush=True)
        if stderr.channel.recv_stderr_ready():
            print(stderr.channel.recv_stderr(65536).decode("utf-8", "replace"), end="", file=sys.stderr, flush=True)
        if stdout.channel.exit_status_ready() and not stdout.channel.recv_ready() and not stderr.channel.recv_stderr_ready():
            break
        time.sleep(0.2)

    leftover = stdout.read().decode("utf-8", "replace")
    leftover_err = stderr.read().decode("utf-8", "replace")
    if leftover:
        print(leftover, end="", flush=True)
    if leftover_err:
        print(leftover_err, end="", file=sys.stderr, flush=True)
    code = stdout.channel.recv_exit_status()
    client.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
