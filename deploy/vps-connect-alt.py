#!/usr/bin/env python3
"""Try multiple alternate ways to reach the CRM VPS."""
from __future__ import annotations

import socket
import subprocess
import sys
import time

HOST = "87.107.54.193"
PASSWORD = "JFbkq4img1"
USERS = ("root", "Root", "admin", "ubuntu", "crm")
PORTS = (9011, 22, 2222, 2200, 22222)

try:
    import paramiko
    from paramiko import Transport
except ImportError:
    print("paramiko missing")
    sys.exit(1)


def tcp_scan() -> list[int]:
    open_ports: list[int] = []
    extra = [21, 80, 443, 8080, 8443, 3389, 5900, 5901, 10000]
    for p in list(PORTS) + extra:
        s = socket.socket()
        s.settimeout(3)
        try:
            ok = s.connect_ex((HOST, p)) == 0
        except OSError:
            ok = False
        finally:
            s.close()
        mark = "OPEN" if ok else "closed"
        print(f"tcp {p:5} {mark}")
        if ok and p in PORTS:
            open_ports.append(p)
        elif ok:
            open_ports.append(p)
    return open_ports


def grab_banner(port: int) -> None:
    s = socket.socket()
    s.settimeout(8)
    try:
        s.connect((HOST, port))
        time.sleep(1.5)
        try:
            data = s.recv(512)
            print(f"banner {port} passive: {data[:120]!r}")
            return
        except socket.timeout:
            pass
        if port in (22, 9011, 2222, 2200, 22222):
            s.sendall(b"SSH-2.0-OpenSSH_9.5_alt\r\n")
            try:
                data = s.recv(512)
                print(f"banner {port} after-ident: {data[:120]!r}")
            except Exception as e:
                print(f"banner {port} no-resp: {type(e).__name__}")
        elif port in (80, 8080, 8443):
            s.sendall(b"HEAD / HTTP/1.0\r\nHost: 87.107.54.193\r\n\r\n")
            try:
                data = s.recv(512)
                print(f"http {port}: {data[:160]!r}")
            except Exception as e:
                print(f"http {port}: {type(e).__name__}")
    except Exception as e:
        print(f"banner {port} fail: {type(e).__name__} {e}")
    finally:
        s.close()


def try_paramiko_client(port: int, user: str) -> bool:
    print(f"\n[paramiko client] {user}@{HOST}:{port}")
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        c.connect(
            HOST,
            port=port,
            username=user,
            password=PASSWORD,
            timeout=25,
            banner_timeout=45,
            auth_timeout=25,
            allow_agent=False,
            look_for_keys=False,
            disabled_algorithms={
                # tolerate older/broken stacks
                "pubkeys": ["rsa-sha2-512", "rsa-sha2-256"],
            },
        )
        _, out, err = c.exec_command("echo CONNECTED; whoami; hostname; uname -a")
        print(out.read().decode("utf-8", "replace") or err.read().decode("utf-8", "replace"))
        c.close()
        return True
    except Exception as e:
        print("fail:", type(e).__name__, e)
        return False


def try_transport_lowlevel(port: int, user: str) -> bool:
    print(f"\n[paramiko Transport] {user}@{HOST}:{port}")
    try:
        sock = socket.create_connection((HOST, port), timeout=20)
        sock.settimeout(40)
        t = Transport(sock)
        t.banner_timeout = 40
        t.auth_timeout = 30
        t.start_client(timeout=40)
        print("remote version:", getattr(t, "remote_version", None))
        t.auth_password(user, PASSWORD)
        chan = t.open_session(timeout=20)
        chan.exec_command("echo TRANSPORT_OK; whoami; hostname")
        out = b""
        while True:
            if chan.recv_ready():
                out += chan.recv(4096)
            elif chan.exit_status_ready():
                break
            else:
                time.sleep(0.1)
        print(out.decode("utf-8", "replace"))
        t.close()
        return True
    except Exception as e:
        print("fail:", type(e).__name__, e)
        return False


def try_openssh(port: int, user: str) -> bool:
    print(f"\n[openssh] {user}@{HOST}:{port}")
    # Use ssh with BatchMode won't work for password; try to see if we get banner/kex in verbose logs
    cmd = [
        "ssh",
        "-vvv",
        "-p",
        str(port),
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "UserKnownHostsFile=NUL",
        "-o",
        "PreferredAuthentications=password",
        "-o",
        "PubkeyAuthentication=no",
        "-o",
        "ConnectTimeout=12",
        "-o",
        "ConnectionAttempts=1",
        f"{user}@{HOST}",
        "echo OPENSSH_OK",
    ]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=20, input="\n")
        mixed = (p.stdout or "") + "\n" + (p.stderr or "")
        # Print key negotiation lines only
        for line in mixed.splitlines():
            if any(
                k in line
                for k in (
                    "Remote protocol",
                    "peer server",
                    "SSH2_MSG",
                    "Authentications",
                    "Permission denied",
                    "Connection reset",
                    "Connection closed",
                    "banner",
                    "OPENSSH_OK",
                    "kex_exchange",
                )
            ):
                print(line)
        return "OPENSSH_OK" in mixed
    except Exception as e:
        print("fail:", type(e).__name__, e)
        return False


def try_plink(port: int, user: str) -> bool:
    plink = r"C:\Program Files\PuTTY\plink.exe"
    print(f"\n[plink] {user}@{HOST}:{port}")
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
        "echo PLINK_OK; whoami; hostname",
    ]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=35)
        out = (p.stdout or "") + (p.stderr or "")
        print(out[:500])
        return "PLINK_OK" in out
    except Exception as e:
        print("fail:", type(e).__name__, e)
        return False


def main() -> int:
    print("=== TCP scan ===")
    open_ports = tcp_scan()
    print("\n=== banners ===")
    for p in sorted(set(list(PORTS) + [80, 443, 8080])):
        if p in open_ports or p in PORTS:
            grab_banner(p)

    ssh_ports = [p for p in open_ports if p in PORTS] or list(PORTS)
    for port in ssh_ports:
        for user in USERS:
            if try_paramiko_client(port, user):
                print("\nSUCCESS paramiko", user, port)
                return 0
            if try_transport_lowlevel(port, user):
                print("\nSUCCESS transport", user, port)
                return 0
            if try_plink(port, user):
                print("\nSUCCESS plink", user, port)
                return 0
        # openssh only for root once per port (won't auth without sshpass)
        try_openssh(port, "root")

    print("\nNO_SSH_ALL_METHODS")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
