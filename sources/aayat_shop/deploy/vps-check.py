#!/usr/bin/env python3
import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username="root", password=PASSWORD, timeout=30)

cmds = [
    "grep plaque /opt/kiaakala/api/dist/routes/address.routes.js | head -2",
    "stat -c %s /tmp/ui-fix-frontend.tar.gz 2>/dev/null || echo 0",
    "grep -rl 'AppAlertBanner\\|useAddressFields\\|پلاک' /var/www/kiaakala/_nuxt/*.js 2>/dev/null | head -1 || echo OLD_FRONTEND",
    "mysql -N -e \"SHOW COLUMNS FROM kiaakala.addresses LIKE 'plaque'\" 2>/dev/null || echo NO_DB",
    "curl -sS http://127.0.0.1:3001/api/health",
]
for cmd in cmds:
    _, o, e = c.exec_command(cmd)
    out = o.read().decode().strip()
    err = e.read().decode().strip()
    print(">", cmd[:70])
    print(out or err or "(empty)")
    print()

c.close()
