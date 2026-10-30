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
urls="
https://mirrors.cloud.tencent.com/nodejs-release/v22.14.0/node-v22.14.0-linux-x64.tar.xz
https://cdn.npmmirror.com/binaries/node/v22.14.0/node-v22.14.0-linux-x64.tar.xz
https://npmmirror.com/mirrors/node/v22.14.0/node-v22.14.0-linux-x64.tar.xz
https://github.com/nodejs/node/releases/download/v22.14.0/node-v22.14.0-linux-x64.tar.xz
https://mirror.ghproxy.com/https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz
https://gitclone.com/github.com/nodejs/node/releases/download/v22.14.0/node-v22.14.0-linux-x64.tar.xz
https://registry.npmmirror.com/
https://registry.npmjs.org/
https://github.com/
http://ubuntu.parsvds.com/ubuntu/
"
for u in $urls; do
  echo -n "TRY $u -> "
  code=$(curl -k -o /dev/null -sS -L --connect-timeout 8 --max-time 20 -w '%{http_code}' "$u" 2>/tmp/curlerr || true)
  err=$(tr -d '\n' </tmp/curlerr 2>/dev/null | tail -c 80)
  echo "$code $err"
done
echo '--- apt nodejs ---'
apt-cache policy nodejs 2>/dev/null | head -8
echo '--- snap ---'
snap info node 2>/dev/null | head -10 || true
"""
_, o, e = c.exec_command(cmd, timeout=300)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
