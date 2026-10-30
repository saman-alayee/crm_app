#!/usr/bin/env python3
"""Install linux esbuild on VPS via SOCKS bridge, point API at compiled or tsx."""
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
PASSWORD = "JFbkq4img1"
SOCKS = ("127.0.0.1", 2080)
BRIDGE_PORT = 18081
ROOT = Path(__file__).resolve().parents[1]


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


def run(c: paramiko.SSHClient, cmd: str, timeout: int = 600) -> int:
    p(f"\n$ {cmd[:180]}...")
    _, out, err = c.exec_command(cmd, timeout=timeout, get_pty=True)
    while not out.channel.exit_status_ready():
        if out.channel.recv_ready():
            p(out.channel.recv(8192).decode("utf-8", "replace"))
        time.sleep(0.05)
    while out.channel.recv_ready():
        p(out.channel.recv(8192).decode("utf-8", "replace"))
    code = out.channel.recv_exit_status()
    p(f"[exit {code}]")
    return code


def main() -> int:
    # Prefer uploading local API dist if present
    dist = ROOT / "apps" / "api" / "dist" / "index.js"
    socks5_connect("example.com", 443, 10).close()
    bridge = start_bridge()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        9011,
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
    rem = None
    for port in (18282, 18383, 18484):
        try:
            tr.request_port_forward("", port)
            rem = port
            break
        except Exception as e:
            p(f"fwd {port}: {e}")
    if rem:
        threading.Thread(target=accept_loop, args=(tr,), daemon=True).start()
        px = f"http://127.0.0.1:{rem}"
    else:
        px = ""

    if dist.exists():
        p("Uploading API dist...")
        sftp = c.open_sftp()
        # ensure remote dist dir
        run(c, "mkdir -p /opt/crm/app/apps/api/dist && chown -R crm:crm /opt/crm/app/apps/api/dist", 30)

        def upload_dir(local: Path, remote: str) -> None:
            for path in local.rglob("*"):
                if path.is_dir():
                    continue
                rel = path.relative_to(local).as_posix()
                rpath = f"{remote}/{rel}"
                rdir = rpath.rsplit("/", 1)[0]
                try:
                    sftp.stat(rdir)
                except Exception:
                    run(c, f"mkdir -p '{rdir}'", 15)
                sftp.put(str(path), rpath)

        upload_dir(ROOT / "apps" / "api" / "dist", "/opt/crm/app/apps/api/dist")
        sftp.close()
        run(c, "chown -R crm:crm /opt/crm/app/apps/api/dist", 30)
        exec_start = "/usr/local/bin/node dist/index.js"
    else:
        p("No dist — npm rebuild esbuild for linux")
        exec_start = "/usr/local/bin/node /opt/crm/app/apps/api/node_modules/tsx/dist/cli.mjs src/index.ts"
        env = f"export http_proxy={px} https_proxy={px} HTTP_PROXY={px} HTTPS_PROXY={px}; " if px else ""
        run(
            c,
            env
            + "cd /opt/crm/app/apps/api && "
            "sudo -u crm npm install esbuild --registry=https://registry.npmjs.org/ 2>&1 | tail -20",
            600,
        )

    run(
        c,
        f"""
cat > /etc/systemd/system/crm-api.service <<EOF
[Unit]
Description=CRM API
After=network.target

[Service]
Type=simple
User=crm
WorkingDirectory=/opt/crm/app/apps/api
EnvironmentFile=/opt/crm/app/.env
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=4000
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=DOTENV_CONFIG_PATH=/opt/crm/app/.env
ExecStart={exec_start}
Restart=always
RestartSec=3
MemoryMax=400M
StandardOutput=append:/opt/crm/logs/api.out.log
StandardError=append:/opt/crm/logs/api.err.log

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl restart crm-api
sleep 5
systemctl --no-pager status crm-api | head -25
curl -fsS --max-time 8 http://127.0.0.1:4000/api/v1/health || echo API_FAIL
echo
curl -fsS --max-time 8 http://127.0.0.1/api/v1/health || echo PROXY_API_FAIL
echo
curl -fsS -o /dev/null -w 'web=%{{http_code}} proxy=%{{http_code}}\\n' --max-time 8 http://127.0.0.1/
tail -n 25 /opt/crm/logs/api.err.log 2>/dev/null || true
""",
        120,
    )
    bridge.shutdown()
    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
