#!/usr/bin/env python3
"""Fast deploy: kill stuck install, SFTP node + built app, run _fast_remote.sh."""
from __future__ import annotations

import select
import socket
import struct
import sys
import tarfile
import tempfile
import threading
import time
from pathlib import Path
from socketserver import StreamRequestHandler, ThreadingTCPServer

import paramiko

HOST = "87.107.54.193"
SSH_PORT = 9011
PASSWORD = "JFbkq4img1"
PUBLIC_HOST = "87.107.54.193"
ADMIN_PASS = "Saman@Crm2026!"
SOCKS = ("127.0.0.1", 2080)
BRIDGE_PORT = 18081
REMOTE_PROXY = 18181
ROOT = Path(__file__).resolve().parents[1]
NODE_TAR = ROOT / "deploy" / "_node_cache" / "node-v22.14.0-linux-x64.tar.xz"
REMOTE_SH = ROOT / "deploy" / "_fast_remote.sh"


def p(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    print(s, flush=True)


def socks5_connect(host: str, port: int, timeout: float = 30) -> socket.socket:
    s = socket.create_connection(SOCKS, timeout=timeout)
    s.settimeout(timeout)
    s.sendall(b"\x05\x01\x00")
    r = s.recv(2)
    if len(r) < 2 or r[1] != 0:
        raise OSError("socks auth")
    hb = host.encode("idna")
    s.sendall(b"\x05\x01\x00\x03" + bytes([len(hb)]) + hb + struct.pack("!H", port))
    h = s.recv(4)
    if len(h) < 4 or h[1] != 0:
        raise OSError("socks connect")
    if h[3] == 1:
        s.recv(6)
    elif h[3] == 3:
        s.recv(s.recv(1)[0] + 2)
    elif h[3] == 4:
        s.recv(18)
    return s


def pipe(a: socket.socket, b: socket.socket) -> None:
    try:
        while True:
            r, _, _ = select.select([a, b], [], [], 120)
            if not r:
                break
            for src, dst in ((a, b), (b, a)):
                if src in r:
                    data = src.recv(65536)
                    if not data:
                        return
                    dst.sendall(data)
    except Exception:
        pass
    finally:
        for x in (a, b):
            try:
                x.close()
            except Exception:
                pass


class Bridge(StreamRequestHandler):
    def handle(self) -> None:
        try:
            data = b""
            while b"\r\n\r\n" not in data:
                c = self.connection.recv(4096)
                if not c:
                    return
                data += c
            first = data.split(b"\r\n", 1)[0].decode("latin1", "replace")
            parts = first.split()
            if len(parts) < 2 or parts[0].upper() != "CONNECT":
                return
            host, ps = parts[1].rsplit(":", 1)
            remote = socks5_connect(host, int(ps))
            self.connection.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            pipe(self.connection, remote)
        except Exception as e:
            p(f"bridge: {e}")


def start_bridge() -> ThreadingTCPServer:
    ThreadingTCPServer.allow_reuse_address = True
    srv = ThreadingTCPServer(("127.0.0.1", BRIDGE_PORT), Bridge)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def ssh_forward(chan: paramiko.Channel) -> None:
    sock = socket.socket()
    try:
        sock.connect(("127.0.0.1", BRIDGE_PORT))
    except Exception:
        chan.close()
        return
    while True:
        r, _, _ = select.select([sock, chan], [], [], 120)
        if not r:
            break
        if sock in r:
            d = sock.recv(65536)
            if not d:
                break
            chan.send(d)
        if chan in r:
            d = chan.recv(65536)
            if not d:
                break
            sock.send(d)
    chan.close()
    sock.close()


def accept_loop(t: paramiko.Transport) -> None:
    while t.is_active():
        try:
            ch = t.accept(1)
        except Exception:
            break
        if ch:
            threading.Thread(target=ssh_forward, args=(ch,), daemon=True).start()


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 1200) -> int:
    p(f"\n$ {cmd[:200]}...")
    _, out, err = c.exec_command(cmd, timeout=timeout, get_pty=True)
    while not out.channel.exit_status_ready():
        if out.channel.recv_ready():
            p(out.channel.recv(8192).decode("utf-8", "replace"))
        if err.channel.recv_stderr_ready():
            p(err.channel.recv_stderr(8192).decode("utf-8", "replace"))
        time.sleep(0.05)
    while out.channel.recv_ready():
        p(out.channel.recv(8192).decode("utf-8", "replace"))
    code = out.channel.recv_exit_status()
    p(f"[exit {code}]")
    return code


def pack() -> Path:
    """Pack only what production needs — avoid symlink cycles in apps/bot."""
    out = Path(tempfile.gettempdir()) / "crm-fast.tgz"
    include = [
        "package.json",
        "package-lock.json",
        "prisma",
        "node_modules",
        "apps/api",
        "apps/dashboard/.output",
        "apps/dashboard/package.json",
        "apps/dashboard/package-lock.json",
    ]

    def filt(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
        n = ti.name.replace("\\", "/")
        # drop broken/circular caches
        if "/.cache/" in n or n.endswith(".log") or n.endswith(".tmp"):
            return None
        # never follow nested workspace links that recurse
        if n.count("node_modules") > 3:
            return None
        return ti

    p(f"Packing selected paths from {ROOT} ...")
    with tarfile.open(out, "w:gz", compresslevel=3) as tar:
        for rel in include:
            path = ROOT / rel
            if not path.exists():
                p(f"  skip missing {rel}")
                continue
            p(f"  + {rel}")
            tar.add(path, arcname=f"app/{rel}", filter=filt, recursive=True)
    p(f"Packed {out.stat().st_size / 1e6:.1f} MB")
    return out


def main() -> int:
    dash = ROOT / "apps" / "dashboard" / ".output" / "server" / "index.mjs"
    if not dash.exists():
        p("Build dashboard first")
        return 1
    if not NODE_TAR.exists():
        p("Missing node tarball")
        return 1

    socks5_connect("example.com", 443, 10).close()
    bridge = start_bridge()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        port=SSH_PORT,
        username="root",
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    tr = c.get_transport()
    assert tr
    rem_port = None
    for port in (18181, 18282, 18383, 19090):
        try:
            tr.request_port_forward("", port)
            rem_port = port
            p(f"Reverse forward on {rem_port}")
            break
        except Exception as e:
            p(f"forward {port} denied: {e}")
    if rem_port is None:
        p("WARN: no reverse tunnel — prisma may fail without mirror")
    else:
        threading.Thread(target=accept_loop, args=(tr,), daemon=True).start()
    p("SSH OK")

    run(
        c,
        "kill $(pgrep -f '/tmp/remote-install.sh') 2>/dev/null || true; "
        "kill $(pgrep -f 'npm install') 2>/dev/null || true; "
        "sleep 1; pgrep -af 'remote-install|npm install' || echo cleaned",
        timeout=30,
    )
    run(
        c,
        "if [ ! -f /swapfile ]; then fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048; "
        "chmod 600 /swapfile; mkswap /swapfile; fi; "
        "swapon /swapfile 2>/dev/null || true; "
        "grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab; "
        "swapon --show; free -h | head -2",
        timeout=60,
    )

    skip_upload = "--reuse-upload" in sys.argv
    sftp = c.open_sftp()
    p("Upload remote script...")
    with sftp.file("/tmp/fast_remote.sh", "w") as f:
        f.write(REMOTE_SH.read_text(encoding="utf-8").replace("\r\n", "\n"))
    sftp.chmod("/tmp/fast_remote.sh", 0o755)

    need_app = True
    if skip_upload:
        try:
            st = sftp.stat("/tmp/crm-fast.tgz")
            if st.st_size and st.st_size > 50_000_000:
                p(f"Reusing /tmp/crm-fast.tgz ({st.st_size / 1e6:.0f} MB)")
                need_app = False
        except Exception:
            need_app = True

    if need_app:
        app_tar = pack()
        # ensure pm2 is in the packed tree (root node_modules)
        p("Upload node...")
        sftp.put(str(NODE_TAR), "/tmp/node-v22.14.0-linux-x64.tar.xz")
        p("Upload app bundle...")
        last = [0.0]

        def cb(a: int, b: int) -> None:
            now = time.time()
            if now - last[0] > 4 or a == b:
                p(f"  {100 * a / b:5.1f}% {a / 1e6:.0f}/{b / 1e6:.0f} MB")
                last[0] = now

        sftp.put(str(app_tar), "/tmp/crm-fast.tgz", callback=cb)
    else:
        try:
            sftp.stat("/tmp/node-v22.14.0-linux-x64.tar.xz")
        except Exception:
            p("Upload node...")
            sftp.put(str(NODE_TAR), "/tmp/node-v22.14.0-linux-x64.tar.xz")
    sftp.close()

    if rem_port:
        px = f"http://127.0.0.1:{rem_port}"
        env = f"export http_proxy={px} https_proxy={px} HTTP_PROXY={px} HTTPS_PROXY={px}; "
    else:
        env = "export http_proxy= https_proxy= HTTP_PROXY= HTTPS_PROXY=; "
    code = run(
        c,
        env
        + f"export PUBLIC_HOST={PUBLIC_HOST} ADMIN_SAMAN_PASSWORD='{ADMIN_PASS}'; "
        "bash /tmp/fast_remote.sh",
        timeout=1800,
    )
    bridge.shutdown()
    c.close()
    return 0 if code == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
