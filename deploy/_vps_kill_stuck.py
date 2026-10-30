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
ss -lntp | grep -E '1808|1818' || echo no_fwd
grep -i AllowTcpForwarding /etc/ssh/sshd_config || true
pkill -f '/tmp/remote-install.sh' 2>/dev/null || true
pkill -f 'npm install' 2>/dev/null || true
sleep 1
pgrep -af 'remote-install|npm install' || echo cleaned
node -v 2>/dev/null || echo NO_NODE
"""
_, o, e = c.exec_command(cmd, timeout=40)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
