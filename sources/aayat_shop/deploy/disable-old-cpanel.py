#!/usr/bin/env python3
"""Disable old cPanel site — redirect all traffic to VPS and remove PHP API."""

import ftplib
import io
import sys
from datetime import datetime, timezone

# Reuse credentials from existing deploy tooling (same cPanel account).
try:
    from ftp_upload import HOST, PASS, USER  # type: ignore
except ImportError:
    HOST = "88.135.68.17"
    USER = "kiaakala"
    PASS = ""

DISABLE_HTACCESS = b"""# Site disabled - active version runs on VPS
RewriteEngine On
RewriteCond %{HTTP_HOST} !^$
RewriteRule ^(.*)$ https://kiaakala.ir/$1 [R=301,L]
"""

DISABLE_INDEX = """<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=https://kiaakala.ir/">
  <title>KIAA KALA</title>
</head>
<body>
  <p>Site moved to new server.</p>
  <p><a href="https://kiaakala.ir/">Go to kiaakala.ir</a></p>
</body>
</html>
""".encode("utf-8")


def ftp_connect() -> ftplib.FTP:
    if not PASS:
        print("Set CPANEL_FTP_PASS environment variable", file=sys.stderr)
        sys.exit(1)
    ftp = ftplib.FTP()
    ftp.connect(HOST, 21, timeout=120)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    return ftp


def rename_if_exists(ftp: ftplib.FTP, old: str, new: str) -> None:
    try:
        ftp.rename(old, new)
        print(f"RENAMED {old} -> {new}")
    except ftplib.error_perm as e:
        print(f"SKIP rename {old}: {e}")


def upload_bytes(ftp: ftplib.FTP, remote: str, data: bytes) -> None:
    ftp.storbinary(f"STOR {remote}", io.BytesIO(data))
    print(f"UPLOADED {remote} ({len(data)} bytes)")


def delete_file(ftp: ftplib.FTP, name: str) -> None:
    try:
        ftp.delete(name)
        print(f"DELETED {name}")
    except ftplib.error_perm as e:
        print(f"SKIP delete {name}: {e}")


def main() -> int:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    ftp = ftp_connect()
    ftp.cwd("/public_html")
    print("Current public_html listing:")
    ftp.retrlines("LIST")

    # Disable PHP API
    rename_if_exists(ftp, "api", f"_disabled_api_{stamp}")

    # Remove deploy / maintenance scripts from web root
    for script in [
        "seed-data.php",
        "fix-api-base.php",
        "restart-api.php",
        "diagnose-api.php",
        "setup-node.php",
        "setup-db.php",
        "setup-api.php",
        "status.php",
        "probe.php",
        "cleanup.php",
        "cleanup-api.php",
        "unzip.php",
        "unzip-api.php",
        "run-sql.php",
    ]:
        delete_file(ftp, script)

    upload_bytes(ftp, ".htaccess", DISABLE_HTACCESS)
    upload_bytes(ftp, "index.html", DISABLE_INDEX)

    print("\nDone. Old cPanel site disabled; requests redirect to https://kiaakala.ir")
    ftp.quit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
