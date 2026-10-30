#!/usr/bin/env python3
import io
from pathlib import Path
import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"
ROOT = Path(__file__).resolve().parents[1]

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60, banner_timeout=60)
    c.get_transport().set_keepalive(15)
    return c

def run(c, cmd, t=300):
    print("$", cmd[:120])
    _, o, e = c.exec_command(cmd, timeout=t)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    if out.strip(): print(out.rstrip()[-2000:])
    if err.strip(): print("ERR:", err.rstrip()[-1000:])
    return code

def upload(c, local: Path, remote: str):
    sftp = c.open_sftp()
    sftp.put(str(local), remote)
    sftp.close()
    print("uploaded", remote)

def main():
    c = connect()
    nginx = ROOT / "deploy" / "vps" / "nginx-kiaakala.conf"
    idx = ROOT / "backend" / "dist" / "index.js"
    cfg = ROOT / "backend" / "dist" / "config" / "index.js"
    upload(c, idx, "/opt/kiaakala/api/dist/index.js")
    upload(c, cfg, "/opt/kiaakala/api/dist/config/index.js")
    data = nginx.read_text(encoding="utf-8").replace("\r\n", "\n")
    sftp = c.open_sftp()
    with sftp.file("/etc/nginx/sites-available/kiaakala", "w") as f:
        f.write(data)
    sftp.close()

    loader = '<style>body{margin:0;background:#f9fafb}#__nuxt:empty{display:flex;min-height:100vh;align-items:center;justify-content:center}#__nuxt:empty::after{content:"";width:2.5rem;height:2.5rem;border:3px solid #16a34a;border-top-color:transparent;border-radius:9999px;animation:kk-spin .8s linear infinite}@keyframes kk-spin{to{transform:rotate(360deg)}}</style>'
    cmds = [
        "find /var/www/kiaakala -name '*.html' -exec sed -i 's|apiBase:\"https://kiaakala.ir/api\"|apiBase:\"/api\"|g' {} +",
        f"grep -q 'kk-spin' /var/www/kiaakala/index.html || sed -i 's|<head>|<head>{loader}|' /var/www/kiaakala/index.html",
        "sed -i 's|^CORS_ORIGIN=.*|CORS_ORIGIN=https://kiaakala.ir,https://www.kiaakala.ir,http://kiaakala.ir,http://www.kiaakala.ir,http://45.94.215.57|' /opt/kiaakala/api/.env",
        "nginx -t && systemctl reload nginx",
        "pm2 restart kiaakala-api --update-env",
        "certbot --nginx -d kiaakala.ir -d www.kiaakala.ir --non-interactive --agree-tos -m admin@kiaakala.ir --redirect 2>&1 || true",
        "nginx -t && systemctl reload nginx",
        "grep apiBase /var/www/kiaakala/index.html | head -1",
        "curl -sS -D - -o /dev/null -H 'Origin: http://kiaakala.ir' http://127.0.0.1:3001/api/health | grep -Ei 'HTTP|access-control'",
        "curl -sS -o /dev/null -w 'https:%{http_code}' https://kiaakala.ir/api/health 2>/dev/null || echo https_fail",
    ]
    for cmd in cmds:
        run(c, cmd, 180)
    c.close()

if __name__ == "__main__":
    main()
