#!/usr/bin/env python3
import paramiko

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(
    "87.107.54.193",
    port=9011,
    username="root",
    password="JFbkq4img1",
    timeout=30,
    banner_timeout=30,
    allow_agent=False,
    look_for_keys=False,
)
cmds = [
    "echo OS; cat /etc/os-release | head -3; uname -a",
    "echo TOOLS; which curl wget git node npm nginx 2>/dev/null; node -v 2>/dev/null; npm -v 2>/dev/null",
    "echo MEM; free -m | head -2; df -h / | tail -1",
    "curl -I --max-time 12 https://github.com 2>&1 | head -8",
    "curl -I --max-time 12 https://registry.npmjs.org 2>&1 | head -8",
    "curl -I --max-time 12 https://deb.nodesource.com 2>&1 | head -5",
    "curl -I --max-time 12 http://archive.ubuntu.com 2>&1 | head -5",
    "ping -c 2 -W 3 8.8.8.8 2>&1 | tail -3",
]
for cmd in cmds:
    print("\n###", cmd)
    _, o, e = c.exec_command(cmd, timeout=25)
    print(o.read().decode("utf-8", "replace")[:800])
    err = e.read().decode("utf-8", "replace")
    if err.strip():
        print("ERR", err[:400])
c.close()
