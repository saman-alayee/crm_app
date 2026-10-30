#!/usr/bin/env python3
"""Deploy shop CRM API src + prisma + dashboard .output to VPS."""
from __future__ import annotations

import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
ROOT = Path(__file__).resolve().parents[1]


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def pack() -> Path:
    out = Path(tempfile.gettempdir()) / "crm-shop.tgz"
    paths = [
        ("apps/api/src", "apps/api/src"),
        ("apps/api/dist", "apps/api/dist"),
        ("prisma/schema.prisma", "prisma/schema.prisma"),
        ("apps/dashboard/.output", "apps/dashboard/.output"),
        ("node_modules/.prisma", "node_modules/.prisma"),
        ("node_modules/@prisma/client", "node_modules/@prisma/client"),
        ("deploy/prisma_engines/schema-engine", "prisma-engines/schema-engine"),
        (
            "deploy/prisma_engines/libquery_engine-debian-openssl-3.0.x.so.node",
            "prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node",
        ),
    ]
    p("packing shop deploy bundle")
    with tarfile.open(out, "w:gz", compresslevel=3) as tar:
        for rel, arc in paths:
            path = ROOT / rel
            if not path.exists():
                raise SystemExit(f"missing {rel}")
            tar.add(path, arcname=arc)
    p(f"size {out.stat().st_size / 1e6:.1f} MB")
    return out


def main() -> int:
    if not (ROOT / "apps/dashboard/.output/server/index.mjs").exists():
        p("missing dashboard .output — build first")
        return 1
    tar_path = pack()

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        9011,
        username="root",
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    sftp = c.open_sftp()
    last = [0.0]

    def cb(a: int, b: int) -> None:
        now = time.time()
        if now - last[0] > 3 or a == b:
            p(f"  {100 * a / b:5.1f}%")
            last[0] = now

    sftp.put(str(tar_path), "/tmp/crm-shop.tgz", callback=cb)
    sftp.close()

    cmd = r"""
set -e
APP=/opt/crm/app
DATA=/opt/crm/data
systemctl stop crm-api crm-web || true
tar -xzf /tmp/crm-shop.tgz -C "$APP"
chown -R crm:crm "$APP/apps/api/src" "$APP/apps/api/dist" "$APP/prisma" "$APP/apps/dashboard/.output"
rm -rf "$APP/apps/api/node_modules/@prisma" "$APP/apps/api/node_modules/.prisma" || true
cd "$APP"
export PATH="/usr/local/bin:$PATH"
NODE=/usr/local/bin/node
PRISMA_JS="$APP/node_modules/prisma/build/index.js"
if [ ! -f "$PRISMA_JS" ]; then PRISMA_JS="$APP/apps/api/node_modules/prisma/build/index.js"; fi
mkdir -p "$APP/prisma-engines"
chmod +x "$APP/prisma-engines/schema-engine" || true
cp -f "$APP/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node" \
  "$APP/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node" 2>/dev/null || true
chown -R crm:crm "$APP/node_modules/.prisma" "$APP/node_modules/@prisma/client" "$APP/prisma-engines"
export PRISMA_SCHEMA_ENGINE_BINARY="$APP/prisma-engines/schema-engine"
export PRISMA_QUERY_ENGINE_LIBRARY="$APP/prisma-engines/libquery_engine-debian-openssl-3.0.x.so.node"
sudo -u crm env PATH="$PATH" PRISMA_SCHEMA_ENGINE_BINARY="$PRISMA_SCHEMA_ENGINE_BINARY" PRISMA_QUERY_ENGINE_LIBRARY="$PRISMA_QUERY_ENGINE_LIBRARY" \
  bash -lc "cd '$APP' && set -a && . ./.env && set +a && DATABASE_URL=\"file:$DATA/prod.db\" '$NODE' '$PRISMA_JS' db push --schema prisma/schema.prisma --skip-generate" || true
sudo -u crm env PATH="$PATH" bash -lc "cd '$APP/apps/api' && set -a && . '$APP/.env' && set +a && DATABASE_URL=\"file:$DATA/prod.db\" '$NODE' dist/db/seed.js"
# switch API unit to compiled dist (avoids broken Windows esbuild/tsx)
cat > /etc/systemd/system/crm-api.service <<EOF
[Unit]
Description=CRM API
After=network.target

[Service]
Type=simple
User=crm
WorkingDirectory=$APP/apps/api
EnvironmentFile=$APP/.env
Environment=DATABASE_URL=file:$DATA/prod.db
Environment=NODE_ENV=production
ExecStart=$NODE dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl start crm-api crm-web
sleep 5
systemctl is-active crm-api crm-web || true
systemctl --no-pager -l status crm-api | sed -n '1,25p' || true
curl -fsS -o /dev/null -w 'api_health=%{http_code}\n' http://127.0.0.1:4000/api/v1/health || true
curl -fsS -o /dev/null -w 'web=%{http_code}\n' http://127.0.0.1:3000/ || true
curl -fsS -o /dev/null -w 'proxy=%{http_code}\n' http://127.0.0.1/ || true
TOKEN=$(curl -fsS -X POST http://127.0.0.1/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"owner","password":"kPr7BbkX3rCwAa1"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
curl -fsS -o /dev/null -w 'trades=%{http_code}\n' -H "Authorization: Bearer $TOKEN" http://127.0.0.1/api/v1/trades || true
curl -fsS -o /dev/null -w 'inventory=%{http_code}\n' -H "Authorization: Bearer $TOKEN" http://127.0.0.1/api/v1/inventory || true
curl -fsS -o /dev/null -w 'opsbank=%{http_code}\n' -H "Authorization: Bearer $TOKEN" http://127.0.0.1/api/v1/ops-bank || true
curl -fsS -o /dev/null -w 'sources=%{http_code}\n' -H "Authorization: Bearer $TOKEN" http://127.0.0.1/api/v1/sources || true
curl -fsS -o /dev/null -w 'public_share=%{http_code}\n' http://127.0.0.1/api/v1/public/share/does-not-exist || true
echo DONE
"""
    _, out, _ = c.exec_command(cmd, timeout=600, get_pty=True)
    while not out.channel.exit_status_ready():
        if out.channel.recv_ready():
            p(out.channel.recv(8192).decode("utf-8", "replace"))
        time.sleep(0.05)
    while out.channel.recv_ready():
        p(out.channel.recv(8192).decode("utf-8", "replace"))
    code = out.channel.recv_exit_status()
    c.close()
    p(f"exit={code}")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
