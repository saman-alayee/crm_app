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
set -e
echo '--- api err ---'
tail -n 40 /opt/crm/logs/api.err.log 2>/dev/null || true
journalctl -u crm-api -n 30 --no-pager || true
echo '--- which ---'
ls -la /usr/local/bin/node /usr/local/bin/npx
ls /opt/crm/app/apps/api/node_modules/tsx/dist/cli.mjs
ls /opt/crm/app/node_modules/tsx/dist/cli.mjs 2>/dev/null || true

TSX=
if [ -f /opt/crm/app/apps/api/node_modules/tsx/dist/cli.mjs ]; then
  TSX=/opt/crm/app/apps/api/node_modules/tsx/dist/cli.mjs
elif [ -f /opt/crm/app/node_modules/tsx/dist/cli.mjs ]; then
  TSX=/opt/crm/app/node_modules/tsx/dist/cli.mjs
fi
echo TSX=$TSX

cat > /etc/systemd/system/crm-api.service <<EOF
[Unit]
Description=CRM API
After=network.target

[Service]
Type=simple
User=crm
WorkingDirectory=/opt/crm/app/apps/api
EnvironmentFile=/opt/crm/app/.env
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=4000
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=DOTENV_CONFIG_PATH=/opt/crm/app/.env
ExecStart=/usr/local/bin/node $TSX src/index.ts
Restart=always
RestartSec=3
MemoryMax=400M
StandardOutput=append:/opt/crm/logs/api.out.log
StandardError=append:/opt/crm/logs/api.err.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl restart crm-api
sleep 4
systemctl --no-pager status crm-api | head -20
curl -fsS --max-time 8 http://127.0.0.1:4000/api/v1/health || echo API_FAIL
echo
curl -fsS -o /dev/null -w 'web=%{http_code} proxy=%{http_code}\n' --max-time 8 http://127.0.0.1/
curl -fsS -o /dev/null -w 'proxy_root=%{http_code}\n' --max-time 8 http://127.0.0.1/
curl -fsS --max-time 8 http://127.0.0.1/api/v1/health || echo PROXY_API_FAIL
echo
tail -n 30 /opt/crm/logs/api.err.log 2>/dev/null || true
"""
_, o, e = c.exec_command(cmd, timeout=120)
print((o.read() + e.read()).decode("utf-8", "replace"))
c.close()
