#!/usr/bin/env python3
"""Reliable FTP upload for deploy (binary mode, resume-friendly)."""
import ftplib
import os
import sys
from pathlib import Path

HOST = "88.135.68.17"
USER = "kiaakala"
PASS = "r4+UQ3r;1Ibh3X"


def ensure_remote_dir(ftp: ftplib.FTP, remote_dir: str) -> None:
    parts = [p for p in remote_dir.replace("\\", "/").split("/") if p]
    path = ""
    for part in parts:
        path += f"/{part}"
        try:
            ftp.cwd(path)
        except ftplib.error_perm:
            ftp.mkd(path)
            ftp.cwd(path)


def upload_tree(ftp: ftplib.FTP, local_root: Path, remote_root: str) -> int:
    uploaded = 0
    local_root = local_root.resolve()
    for root, dirs, files in os.walk(local_root):
        rel = Path(root).relative_to(local_root).as_posix()
        remote_dir = remote_root if rel == "." else f"{remote_root}/{rel}"
        ensure_remote_dir(ftp, remote_dir)
        ftp.cwd(f"/{remote_dir}")
        for name in files:
            local_path = Path(root) / name
            size = local_path.stat().st_size
            with open(local_path, "rb") as fh:
                ftp.storbinary(f"STOR {name}", fh)
            uploaded += 1
            print(f"OK /{remote_dir}/{name} ({size} bytes)")
    return uploaded


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: ftp_upload.py <local_dir> <remote_dir>")
        sys.exit(1)

    local_dir = Path(sys.argv[1])
    remote_dir = sys.argv[2].strip("/")

    if not local_dir.is_dir():
        print(f"Missing local dir: {local_dir}")
        sys.exit(1)

    print(f"Uploading {local_dir} -> /{remote_dir}")
    ftp = ftplib.FTP()
    ftp.connect(HOST, 21, timeout=120)
    ftp.login(USER, PASS)
    ftp.set_pasv(True)
    count = upload_tree(ftp, local_dir, remote_dir)
    ftp.quit()
    print(f"DONE: {count} files")


if __name__ == "__main__":
    main()
