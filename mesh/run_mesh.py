# /opt/projects/iot-wireless-mesh-daq/mesh/run_mesh.py
#!/usr/bin/env python3
import subprocess
import os
import time
import signal
import sys

children = []


def shutdown(signum, frame):
    print(f"[run_mesh] signal {signum}; shutting down children...", flush=True)
    for p in children:
        if p.poll() is None:
            p.terminate()
            try:
                p.wait(timeout=5)
                print(f"[run_mesh] terminated pid {p.pid}", flush=True)
            except subprocess.TimeoutExpired:
                p.kill()
                print(f"[run_mesh] killed pid {p.pid}", flush=True)
    sys.exit(0)


def spawn(py, script, cwd):
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    return subprocess.Popen(
        [py, "-u", script],
        cwd=cwd,
        env=env,
        stdout=sys.stdout,   # let systemd capture
        stderr=sys.stderr,
    )


def main():
    base = os.path.dirname(os.path.abspath(__file__))

    # *** IMPORTANT CHANGE ***
    # Use the same interpreter that launched run_mesh.py
    py = sys.executable
    print(f"[run_mesh] using interpreter: {py}", flush=True)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    print("[run_mesh] starting rundaq.py...", flush=True)
    children.append(spawn(py, os.path.join(base, "rundaq.py"), base))

    print("[run_mesh] starting emulator.py...", flush=True)
    children.append(spawn(py, os.path.join(base, "emulator.py"), base))

    print("[run_mesh] running.", flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        shutdown(signal.SIGINT, None)


if __name__ == "__main__":
    main()
