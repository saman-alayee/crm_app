#!/usr/bin/env python3
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "87.107.54.193",
    9011,
    username="root",
    password="JFbkq4img1",
    timeout=40,
    banner_timeout=40,
    auth_timeout=40,
    allow_agent=False,
    look_for_keys=False,
)
cmd = r"""
echo '=== nginx error ==='
tail -n 20 /var/log/nginx/error.log 2>/dev/null || true
echo '=== nginx login lines ==='
grep 'auth/login' /var/log/nginx/access.log 2>/dev/null | tail -15 || true
echo '=== api err ==='
tail -n 40 /opt/crm/logs/api.err.log 2>/dev/null || true
echo '=== reset pass ==='
cd /opt/crm/app/apps/api
sudo -u crm env DATABASE_URL='file:/opt/crm/data/prod.db' node /tmp/reset-pass.mjs 2>&1 | tail -30
"""
_, o, e = c.exec_command(cmd, timeout=90)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
