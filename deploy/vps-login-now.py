#!/usr/bin/env python3
"""Login attempt with provider credentials (Linux Root / Windows Administrator)."""
from __future__ import annotations

import socket
import subprocess
import sys
import time

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
PORTS_SSH = (9011, 22, 2222)
PORTS_EXTRA = (3389, 5985, 5986, 445, 80, 443)

try:
    import paramiko
except ImportError:
    print("need paramiko")
    sys.exit(1)


def tcp(port: int, timeout: float = 4.0) -> bool:
    s = socket.socket()
    s.settimeout(timeout)
    try:
        return s.connect_ex((HOST, port)) == 0
    except OSError:
        return False
    finally:
        s.close()


def ssh_paramiko(port: int, user: str) -> bool:
    print(f"\n== paramiko {user}@{HOST}:{port}")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        c.connect(
            HOST,
            port=port,
            username=user,
            password=PASSWORD,
            timeout=20,
            banner_timeout=30,
            auth_timeout=25,
            allow_agent=False,
            look_for_keys=False,
        )
        _, o, e = c.exec_command("echo OK; whoami; hostname; uname -a 2>/dev/null; ver 2>nul")
        print((o.read() or e.read()).decode("utf-8", "replace"))
        c.close()
        print("SUCCESS_PARAMIKO", user, port)
        return True
    except Exception as ex:
        print("fail:", type(ex).__name__, ex)
        return False


def ssh_plink(port: int, user: str) -> bool:
    plink = r"C:\Program Files\PuTTY\plink.exe"
    print(f"\n== plink {user}@{HOST}:{port}")
    cmd = [
        plink,
        "-ssh",
        "-P",
        str(port),
        "-l",
        user,
        "-pw",
        PASSWORD,
        "-batch",
        HOST,
        "echo PLINK_OK & whoami & hostname",
    ]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
        out = (p.stdout or "") + (p.stderr or "")
        print(out[:600])
        if "PLINK_OK" in out or "Administrator" in out or "root" in out.lower():
            print("SUCCESS_PLINK", user, port)
            return True
    except Exception as ex:
        print("fail:", type(ex).__name__, ex)
    return False


def try_rdp_banner() -> None:
    print("\n== RDP/3389 probe")
    if not tcp(3389):
        print("3389 closed")
        return
    s = socket.socket()
    s.settimeout(8)
    try:
        s.connect((HOST, 3389))
        # RDP cookie / X.224 connection request often gets a response
        # Minimal TPKT + X.224 CR
        pkt = bytes.fromhex(
            "0300002a26e000000000004300006d006900630072006f0073006f006600740000"
        )
        s.sendall(pkt)
        data = s.recv(256)
        print("rdp resp", data[:80].hex() if data else "empty")
    except Exception as ex:
        print("rdp fail", type(ex).__name__, ex)
    finally:
        s.close()


def main() -> int:
    print("TCP scan:")
    for p in list(PORTS_SSH) + list(PORTS_EXTRA):
        print(f"  {p}: {'OPEN' if tcp(p) else 'closed'}")

    try_rdp_banner()

    users = ("Root", "root", "Administrator", "administrator", "Admin")
    for port in PORTS_SSH:
        if not tcp(port):
            continue
        for user in users:
            if ssh_paramiko(port, user):
                return 0
            if ssh_plink(port, user):
                return 0

    print("\nNO_LOGIN")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
