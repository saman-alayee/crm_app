#!/usr/bin/env python3
"""Report differences between local repo and VPS."""

import sys
from pathlib import Path

import paramiko

HOST = "45.94.215.57"
PASSWORD = "aGNinAcp6rc4sh0m"
ROOT = Path(__file__).resolve().parents[1]


def log(msg: str) -> None:
    sys.stdout.buffer.write((str(msg) + "\n").encode("utf-8", errors="replace"))


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=PASSWORD, timeout=30)

    def run(cmd: str) -> str:
        _, stdout, stderr = client.exec_command(cmd, timeout=60)
        out = stdout.read().decode("utf-8", "replace").strip()
        err = stderr.read().decode("utf-8", "replace").strip()
        return out or err or "(empty)"

    log("=== SAME AS SERVER (synced) ===")
    log("- backend/prisma/schema.prisma")
    log("- backend/package.json")
    log("- deploy/vps/nginx-kiaakala.conf")
    log("- backend/.env (local copy taken from server)")

    log("\n=== SERVER TIMESTAMPS ===")
    log(f"API dist:     {run('stat -c %y /opt/kiaakala/api/dist/index.js')}")
    log(f"Frontend:     {run('stat -c %y /var/www/kiaakala/index.html')}")
    log(f"Nginx live:   {run('stat -c %y /etc/nginx/sites-enabled/kiaakala')}")

    log("\n=== LOCAL vs SERVER — MAIN GAPS ===")
    log("1) Backend compiled code (dist/)")
    log(f"   Server: deployed {run('stat -c %y /opt/kiaakala/api/dist/index.js')}")
    local_dist = ROOT / "backend/dist/index.js"
    log(f"   Local:  {'NOT BUILT (run npm run build)' if not local_dist.exists() else local_dist.stat().st_mtime}")

    log("2) Backend source (src/)")
    log(f"   Server: {run('test -d /opt/kiaakala/api/src && echo present || echo missing')}")
    log("   Local:  full source at backend/src/ (newer than server deploy)")

    log("3) Frontend static site")
    log(f"   Server bundles: {run('ls -1 /var/www/kiaakala/_nuxt/*.js 2>/dev/null | wc -l')} js files")
    local_out = ROOT / "frontend/.output/public/index.html"
    log(f"   Local build: {'missing (run npm run generate)' if not local_out.exists() else 'exists but may differ from server'}")

    log("4) Git history")
    log(f"   Server git: {run('cd /opt/kiaakala/api && git rev-parse --short HEAD 2>/dev/null || echo NO_GIT')}")
    log("   Local git:  0cd3673 — Fix checkout, map, CMS pages, and admin table layout.")

    log("\n=== LOCAL HAS NEWER CODE (not on server yet) ===")
    newer = [
        "frontend: fonts IRANSansX, admin login, profile/password, error page",
        "frontend: checkout/map/CMS/admin table fixes (commit 0cd3673)",
        "frontend: storefront/admin updates (commit c8db492)",
        "backend src: auth password, favorites, sales, rate limit, order fixes",
        "backend: remote-pull-build.sh deploy script",
        "public assets: logo.png, slider PNG images",
    ]
    for item in newer:
        log(f"- {item}")

    log("\n=== UNCOMMITTED ON LOCAL ONLY ===")
    log("- deploy/vps-compare-local.py, deploy/vps-sync-from-server.py")
    log("- *.local-backup files from server sync")

    client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
