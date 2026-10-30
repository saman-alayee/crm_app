#!/usr/bin/env python3
"""Upload a single file via FTP with size verification."""
import ftplib
import sys
from pathlib import Path

HOST = "88.135.68.17"
USER = "kiaakala"
PASS = "r4+UQ3r;1Ibh3X"


def upload_file(local_path: Path, remote_path: str) -> None:
    size = local_path.stat().st_size
    print(f"Uploading {local_path} ({size} bytes) -> /{remote_path}")
    ftp = ftplib.FTP()
    ftp.connect(HOST, 21, timeout=300)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    with open(local_path, "rb") as fh:
        ftp.storbinary(f"STOR /{remote_path}", fh, blocksize=1024 * 256)
    remote_size = ftp.size(f"/{remote_path}")
    ftp.quit()
    print(f"Remote size: {remote_size}")
    if remote_size != size:
        raise SystemExit(f"Size mismatch local={size} remote={remote_size}")
    print("OK")


if __name__ == "__main__":
    upload_file(Path(sys.argv[1]), sys.argv[2])
