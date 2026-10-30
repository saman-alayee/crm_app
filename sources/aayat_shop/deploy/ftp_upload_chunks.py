#!/usr/bin/env python3
import ftplib
import sys
from pathlib import Path

HOST = "88.135.68.17"
USER = "kiaakala"
PASS = "r4+UQ3r;1Ibh3X"
CHUNK = 1024 * 1024  # 1MB

local = Path(sys.argv[1])
remote_dir = sys.argv[2]
remote_name = Path(sys.argv[3]).name

ftp = ftplib.FTP()
ftp.connect(HOST, 21, timeout=300)
ftp.login(USER, PASS)
ftp.set_pasv(True)

parts = []
data = local.read_bytes()
for i in range(0, len(data), CHUNK):
    part = data[i:i + CHUNK]
    part_name = f"{remote_name}.part{i // CHUNK:04d}"
    parts.append(part_name)
    with open(local.parent / part_name, 'wb') as tmp:
        tmp.write(part)
    with open(local.parent / part_name, 'rb') as fh:
        ftp.storbinary(f'STOR /{remote_dir}/{part_name}', fh, blocksize=256 * 1024)
    print(f'uploaded {part_name} ({len(part)} bytes)')

manifest = '\n'.join(parts)
(manifest_path := local.parent / f'{remote_name}.manifest.txt').write_text(manifest, encoding='utf-8')
with open(manifest_path, 'rb') as fh:
    ftp.storbinary(f'STOR /{remote_dir}/{remote_name}.manifest.txt', fh)
print('DONE', len(parts), 'parts')
