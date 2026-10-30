#!/usr/bin/env python3
import sys
import time
from pathlib import Path

import paramiko

HOST = "87.107.54.193"
PORT = 9011
PASSWORD = "JFbkq4img1"
SCRIPT = Path(__file__).with_name("remote-install.sh")


def safe_print(text: str) -> None:
    try:
        sys.stdout.write(text)
    except UnicodeEncodeError:
        sys.stdout.buffer.write(text.encode("utf-8", "replace"))
    sys.stdout.flush()


def main() -> int:
    # force utf-8 where possible
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(
        HOST,
        port=PORT,
        username="root",
        password=PASSWORD,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
        allow_agent=False,
        look_for_keys=False,
    )
    print("SSH OK, uploading remote-install.sh", flush=True)
    sftp = c.open_sftp()
    with sftp.file("/tmp/remote-install.sh", "w") as f:
        f.write(SCRIPT.read_text(encoding="utf-8").replace("\r\n", "\n"))
    sftp.chmod("/tmp/remote-install.sh", 0o755)
    sftp.close()

    # Detached via pidfile — never pgrep the SSH cmdline (it contains the script path).
    start_cmd = r"""
set -e
PIDFILE=/tmp/crm-install.pid
if [ -f "$PIDFILE" ]; then
  old=$(cat "$PIDFILE" 2>/dev/null || true)
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then
    echo ALREADY_RUNNING pid=$old
    exit 0
  fi
fi
: > /tmp/crm-install.log
export PUBLIC_HOST=87.107.54.193
export ADMIN_SAMAN_PASSWORD='Saman@Crm2026!'
nohup /bin/bash /tmp/remote-install.sh >> /tmp/crm-install.log 2>&1 &
echo $! > "$PIDFILE"
echo PID:$(cat "$PIDFILE")
sleep 2
if kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then echo START_OK; else echo START_FAILED; fi
"""
    _, stdout, _ = c.exec_command(start_cmd, timeout=30)
    print(stdout.read().decode("utf-8", "replace"), flush=True)

    print("Tailing /tmp/crm-install.log ...", flush=True)
    last_size = 0
    idle = 0
    ticks = 0
    max_ticks = 360  # ~60 min @ 10s
    while idle < 120 and ticks < max_ticks:  # 20 min idle or 60 min total
        ticks += 1
        _, stdout, _ = c.exec_command(
            "wc -c < /tmp/crm-install.log 2>/dev/null || echo 0; "
            "tail -n 30 /tmp/crm-install.log 2>/dev/null; "
            "pid=$(cat /tmp/crm-install.pid 2>/dev/null || true); "
            "if [ -n \"$pid\" ] && kill -0 \"$pid\" 2>/dev/null; then echo RUNNING:$pid; "
            "else echo DONE_PROCESS; fi",
            timeout=30,
        )
        out = stdout.read().decode("utf-8", "replace")
        lines = out.splitlines()
        try:
            size = int(lines[0].strip())
        except Exception:
            size = last_size
        body = "\n".join(lines[1:])
        if size > last_size:
            safe_print(body[-3500:] + "\n")
            last_size = size
            idle = 0
        else:
            idle += 1
        if "URL: http://" in out:
            break
        if "DONE_PROCESS" in out:
            _, stdout, _ = c.exec_command("tail -n 80 /tmp/crm-install.log", timeout=30)
            end = stdout.read().decode("utf-8", "replace")
            safe_print(end + "\n")
            if "URL: http://" in end:
                break
            print("Install process ended without success marker", flush=True)
            c.close()
            return 1
        time.sleep(10)

    _, stdout, _ = c.exec_command(
        "sudo -u crm pm2 status 2>/dev/null; "
        "curl -fsS --max-time 5 http://127.0.0.1:4000/api/v1/health; echo; "
        "curl -fsS -o /dev/null -w 'proxy=%{http_code}\\n' --max-time 5 http://127.0.0.1/; "
        "echo -n saman:; cat /opt/crm/ADMIN_SAMAN.txt 2>/dev/null; echo; "
        "echo -n owner:; cat /opt/crm/CREDENTIALS.txt 2>/dev/null; echo",
        timeout=40,
    )
    safe_print(stdout.read().decode("utf-8", "replace") + "\n")
    c.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
