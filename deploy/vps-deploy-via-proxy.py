#!/usr/bin/env python3
"""Deploy CRM: local SOCKS(2080) -> local HTTP bridge -> SSH reverse tunnel -> VPS."""
from __future__ import annotations

import select
import socket
import struct
import sys
import threading
import time
from pathlib import Path
from socketserver import StreamRequestHandler, ThreadingTCPServer

import paramiko

HOST = "87.107.54.193"
SSH_PORT = 9011
USER = "root"
PASSWORD = "JFbkq4img1"
PUBLIC_HOST = "87.107.54.193"
ADMIN_PASS = "Saman@Crm2026!"
SOCKS_HOST, SOCKS_PORT = "127.0.0.1", 2080
BRIDGE_PORT = 18081  # local HTTP CONNECT -> SOCKS
REMOTE_PROXY_PORT = 18080
ROOT = Path(__file__).resolve().parents[1]
NODE_TAR = ROOT / "deploy" / "_node_cache" / "node-v22.14.0-linux-x64.tar.xz"
SCRIPT = ROOT / "deploy" / "remote-install.sh"


def safe_print(s: str) -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        print(s, flush=True)
    except UnicodeEncodeError:
        sys.stdout.buffer.write((s + "\n").encode("utf-8", "replace"))
        sys.stdout.flush()


def socks5_connect(dest_host: str, dest_port: int, timeout: float = 30) -> socket.socket:
    s = socket.create_connection((SOCKS_HOST, SOCKS_PORT), timeout=timeout)
    s.settimeout(timeout)
    s.sendall(b"\x05\x01\x00")
    resp = s.recv(2)
    if len(resp) < 2 or resp[0] != 5 or resp[1] != 0:
        s.close()
        raise OSError(f"SOCKS auth failed: {resp!r}")
    host_b = dest_host.encode("idna")
    req = b"\x05\x01\x00\x03" + bytes([len(host_b)]) + host_b + struct.pack("!H", dest_port)
    s.sendall(req)
    hdr = s.recv(4)
    if len(hdr) < 4 or hdr[1] != 0:
        s.close()
        raise OSError(f"SOCKS connect failed: {hdr!r}")
    atyp = hdr[3]
    if atyp == 1:
        s.recv(4 + 2)
    elif atyp == 3:
        ln = s.recv(1)[0]
        s.recv(ln + 2)
    elif atyp == 4:
        s.recv(16 + 2)
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
        try:
            a.close()
        except Exception:
            pass
        try:
            b.close()
        except Exception:
            pass


class HttpConnectHandler(StreamRequestHandler):
    def handle(self) -> None:
        try:
            data = b""
            while b"\r\n\r\n" not in data:
                chunk = self.connection.recv(4096)
                if not chunk:
                    return
                data += chunk
                if len(data) > 65536:
                    return
            first = data.split(b"\r\n", 1)[0].decode("latin1", "replace")
            parts = first.split()
            if len(parts) < 2:
                return
            method, target = parts[0].upper(), parts[1]
            if method == "CONNECT":
                host, port_s = target.rsplit(":", 1)
                port = int(port_s)
                remote = socks5_connect(host, port)
                self.connection.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                pipe(self.connection, remote)
                return
            # plain HTTP absolute-form
            if target.startswith("http://"):
                from urllib.parse import urlparse

                u = urlparse(target)
                host = u.hostname or ""
                port = u.port or 80
                path = u.path or "/"
                if u.query:
                    path += "?" + u.query
                remote = socks5_connect(host, port)
                rest = data.split(b"\r\n", 1)[1] if b"\r\n" in data else b"\r\n"
                # rebuild request with path only
                new_req = f"{method} {path} HTTP/1.1\r\n".encode("latin1") + rest
                if b"\r\nHost:" not in new_req and b"\r\nhost:" not in new_req:
                    new_req = new_req.replace(b"\r\n", f"\r\nHost: {host}\r\n".encode("latin1"), 1)
                remote.sendall(new_req)
                pipe(self.connection, remote)
        except Exception as e:
            safe_print(f"bridge err: {e}")


def start_http_bridge() -> ThreadingTCPServer:
    ThreadingTCPServer.allow_reuse_address = True
    srv = ThreadingTCPServer(("127.0.0.1", BRIDGE_PORT), HttpConnectHandler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    safe_print(f"HTTP->SOCKS bridge on 127.0.0.1:{BRIDGE_PORT} via {SOCKS_HOST}:{SOCKS_PORT}")
    return srv


def ssh_handler(chan: paramiko.Channel, host: str, port: int) -> None:
    sock = socket.socket()
    try:
        sock.connect((host, port))
    except Exception as e:
        safe_print(f"tunnel connect fail: {e}")
        chan.close()
        return
    while True:
        r, _, _ = select.select([sock, chan], [], [], 120)
        if not r:
            break
        if sock in r:
            data = sock.recv(65536)
            if not data:
                break
            chan.send(data)
        if chan in r:
            data = chan.recv(65536)
            if not data:
                break
            sock.send(data)
    chan.close()
    sock.close()


def accept_loop(transport: paramiko.Transport) -> None:
    while transport.is_active():
        try:
            chan = transport.accept(1)
        except Exception:
            break
        if chan is None:
            continue
        threading.Thread(
            target=ssh_handler, args=(chan, "127.0.0.1", BRIDGE_PORT), daemon=True
        ).start()


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 3600) -> tuple[int, str]:
    safe_print(f"\n$ {cmd[:240]}...")
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout, get_pty=True)
    buf: list[str] = []
    while not stdout.channel.exit_status_ready():
        if stdout.channel.recv_ready():
            part = stdout.channel.recv(8192).decode("utf-8", "replace")
            buf.append(part)
            safe_print(part)
        if stderr.channel.recv_stderr_ready():
            part = stderr.channel.recv_stderr(8192).decode("utf-8", "replace")
            buf.append(part)
            safe_print(part)
        time.sleep(0.05)
    while stdout.channel.recv_ready():
        part = stdout.channel.recv(8192).decode("utf-8", "replace")
        buf.append(part)
        safe_print(part)
    code = stdout.channel.recv_exit_status()
    safe_print(f"[exit {code}]")
    return code, "".join(buf)


def main() -> int:
    # SOCKS check
    try:
        t = socks5_connect("example.com", 443, timeout=10)
        t.close()
        safe_print("Local SOCKS OK")
    except Exception as e:
        safe_print(f"Local SOCKS {SOCKS_HOST}:{SOCKS_PORT} failed: {e}")
        return 2

    bridge = start_http_bridge()

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        port=SSH_PORT,
        username=USER,
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    safe_print("SSH OK")
    transport = c.get_transport()
    assert transport is not None
    transport.request_port_forward("", REMOTE_PROXY_PORT)
    threading.Thread(target=accept_loop, args=(transport,), daemon=True).start()
    safe_print(f"Reverse tunnel VPS:{REMOTE_PROXY_PORT} -> bridge:{BRIDGE_PORT}")

    proxy_env = (
        f"export http_proxy=http://127.0.0.1:{REMOTE_PROXY_PORT} "
        f"https_proxy=http://127.0.0.1:{REMOTE_PROXY_PORT} "
        f"HTTP_PROXY=http://127.0.0.1:{REMOTE_PROXY_PORT} "
        f"HTTPS_PROXY=http://127.0.0.1:{REMOTE_PROXY_PORT}; "
        "export NO_PROXY=127.0.0.1,localhost,ubuntu.parsvds.com,mirror.iranserver.com;"
    )

    code, out = run(
        c,
        proxy_env
        + " curl -fsS -o /dev/null -w 'nodejs=%{http_code}\\n' --connect-timeout 25 --max-time 90 "
        "https://nodejs.org/dist/index.json; "
        "curl -fsS -o /dev/null -w 'npmreg=%{http_code}\\n' --connect-timeout 25 --max-time 90 "
        "https://registry.npmjs.org/",
        timeout=200,
    )
    if "nodejs=200" not in out and "npmreg=200" not in out:
        safe_print("Proxy path still broken — abort")
        bridge.shutdown()
        c.close()
        return 3
    safe_print("Proxy path OK")

    # Pack and upload source (avoids flaky git clone + permission issues)
    import tarfile
    import tempfile

    src_tar = Path(tempfile.gettempdir()) / "crm-app-src.tgz"
    skip = {
        ".git",
        "node_modules",
        "sources",
        ".nuxt",
        ".output",
        "dist",
        "coverage",
        ".turbo",
        "__pycache__",
        ".cursor",
        "_node_cache",
    }

    def filt(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
        parts = ti.name.replace("\\", "/").split("/")
        if any(p in skip for p in parts):
            return None
        if ti.name.endswith((".log", ".tmp")):
            return None
        if "/deploy/_" in ti.name.replace("\\", "/") or ti.name.startswith("deploy/_"):
            return None
        return ti

    safe_print(f"Packing source -> {src_tar}")
    with tarfile.open(src_tar, "w:gz", compresslevel=5) as tar:
        for item in ROOT.iterdir():
            if item.name in skip:
                continue
            if item.name.startswith(".") and item.name not in (".env.example",):
                continue
            tar.add(item, arcname=item.name, filter=filt)
    safe_print(f"Source tarball {src_tar.stat().st_size / 1e6:.1f} MB")

    sftp = c.open_sftp()
    if NODE_TAR.exists():
        safe_print("Uploading node tarball...")
        sftp.put(str(NODE_TAR), "/tmp/node-v22.14.0-linux-x64.tar.xz")
    safe_print("Uploading app source...")
    sftp.put(str(src_tar), "/tmp/crm-app-src.tgz")
    with sftp.file("/tmp/remote-install.sh", "w") as f:
        f.write(SCRIPT.read_text(encoding="utf-8").replace("\r\n", "\n"))
    sftp.chmod("/tmp/remote-install.sh", 0o755)
    sftp.close()

    code, _ = run(
        c,
        proxy_env
        + rf"""
set -e
export PUBLIC_HOST={PUBLIC_HOST}
export ADMIN_SAMAN_PASSWORD='{ADMIN_PASS}'
npm config set proxy http://127.0.0.1:{REMOTE_PROXY_PORT} || true
npm config set https-proxy http://127.0.0.1:{REMOTE_PROXY_PORT} || true
bash /tmp/remote-install.sh
""",
        timeout=3600,
    )

    run(
        c,
        "sudo -u crm pm2 status 2>/dev/null; "
        "curl -fsS --max-time 8 http://127.0.0.1:4000/api/v1/health; echo; "
        "curl -fsS -o /dev/null -w 'proxy=%{http_code}\\n' --max-time 8 http://127.0.0.1/; "
        "echo -n saman:; cat /opt/crm/ADMIN_SAMAN.txt 2>/dev/null; echo; "
        "echo -n owner:; cat /opt/crm/CREDENTIALS.txt 2>/dev/null; echo",
        timeout=60,
    )
    bridge.shutdown()
    c.close()
    return 0 if code == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
