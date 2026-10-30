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
# Kill old forward session and stuck installs carefully by PID from ss/pgrep files
cmd = r"""
# kill stuck install PIDs only
for pid in $(pgrep -f '/tmp/remote-install\.sh' || true); do kill -9 "$pid" 2>/dev/null || true; done
for pid in $(pgrep -x npm || true); do kill -9 "$pid" 2>/dev/null || true; done
# drop stale ssh reverse-forward holder if any (old deploy)
if ss -lntp | grep -q ':18080'; then
  pid=$(ss -lntp | awk '/:18080/{match($0,/pid=([0-9]+)/,a); print a[1]; exit}')
  echo stale_fwd_pid=$pid
  [ -n "$pid" ] && kill "$pid" 2>/dev/null || true
fi
sleep 1
ss -lntp | grep -E '1808|1818' || echo forwards_clear
pgrep -af 'remote-install|npm' || echo procs_clear
node -v
"""
_, o, e = c.exec_command(cmd, timeout=40)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
