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
set +e
echo '--- github clone test ---'
timeout 45 git ls-remote https://github.com/saman-alayee/crm_app.git HEAD 2>&1 | head -5
echo '--- node release headers ---'
curl -k -I -L --connect-timeout 15 --max-time 45 'https://github.com/nodejs/node/releases/download/v22.14.0/node-v22.14.0-linux-x64.tar.xz' 2>&1 | head -25
echo '--- arvan ---'
curl -k -I -L --connect-timeout 10 --max-time 25 'https://mirror.arvancloud.ir/nodejs/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz' 2>&1 | head -15
echo '--- aliyun http ---'
curl -k -I -L --connect-timeout 10 --max-time 25 'http://mirrors.aliyun.com/nodejs-release/v22.14.0/node-v22.14.0-linux-x64.tar.xz' 2>&1 | head -15
"""
_, o, e = c.exec_command(cmd, timeout=300)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
