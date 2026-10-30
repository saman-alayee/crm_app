#!/usr/bin/env python3
"""Finish VPS deploy steps + verify."""
import sys
import paramiko

HOST = "45.94.215.57"
PASSWORD = "KiaaKala2026VpsSecure9"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def log(msg):
    print(msg, flush=True)


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username="root", password=PASSWORD, timeout=60)
    return c


def run(c, cmd, t=300):
    log(f"$ {cmd[:100]}")
    _, o, e = c.exec_command(cmd, timeout=t)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        log(out.rstrip()[-2500:])
    if err.strip():
        log(f"stderr: {err.rstrip()[-800:]}")
    return code


def main():
    c = connect()
    run(c, "cd /opt/kiaakala/api && npx prisma db push --accept-data-loss")
    run(c, "pm2 restart kiaakala-api --update-env")
    run(c, "curl -sS http://127.0.0.1:3001/api/health")
    run(c, "mysql -N -e \"SHOW COLUMNS FROM kiaakala.addresses LIKE 'plaque'; SHOW COLUMNS FROM kiaakala.addresses LIKE 'unit';\"")
    run(c, "grep -c plaque /opt/kiaakala/api/dist/routes/address.routes.js")
    run(c, "grep -rl 'پلاک' /var/www/kiaakala/_nuxt/*.js 2>/dev/null | wc -l")
    run(c, "curl -sS -o /dev/null -w 'site:%{http_code}' http://127.0.0.1/")
    c.close()
    log("Verify done")


if __name__ == "__main__":
    main()
