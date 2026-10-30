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
echo '--- procs ---'
pgrep -af 'remote-install|npm install|nuxt|node' | head -20 || echo none
echo '--- opt ---'
ls -la /opt/crm 2>/dev/null || echo no_opt
ls /opt/crm/app/node_modules 2>/dev/null | wc -l
ls /opt/crm/app/apps/api/node_modules 2>/dev/null | wc -l
ls /opt/crm/app/apps/dashboard/node_modules 2>/dev/null | wc -l
test -f /opt/crm/app/apps/dashboard/.output/server/index.mjs && echo DASH_OK || echo DASH_NO
echo '--- ports ---'
ss -lntp | grep -E ':(80|3000|4000) ' || true
curl -sS -o /dev/null -w 'proxy:%{http_code}\n' --max-time 4 http://127.0.0.1/ || true
curl -sS --max-time 4 http://127.0.0.1:4000/api/v1/health || echo API_DOWN
echo
free -h | head -2
node -v 2>/dev/null || echo NO_NODE
"""
_, o, e = c.exec_command(cmd, timeout=60)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
