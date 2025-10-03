#!/usr/bin/env python3
import subprocess
import os
import time
import signal
import sys

# Track child processes for clean shutdown
child_procs = []

def shutdown(signum, frame):
    print(f"[run_mesh-daq] Received signal {signum}. Shutting down children...")
    for proc in child_procs:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
                print(f"[run_mesh-daq] Terminated PID {proc.pid}")
            except subprocess.TimeoutExpired:
                proc.kill()
                print(f"[run_mesh-daq] Force-killed PID {proc.pid}")
    sys.exit(0)

def main():
    # Trap TERM and INT for clean shutdown
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)

    # === Launch DAQ core ===
    print("[run_mesh-daq] Launching rundaq.py...")
    rundaq_proc = subprocess.Popen([sys.executable, "/opt/projects/iot-wireless-mesh-daq/mesh/rundaq.py"])
    child_procs.append(rundaq_proc)

    # === Launch Emulator ===
    print("[run_mesh-daq] Launching emulator.py...")
    emulator_proc = subprocess.Popen([sys.executable, "/opt/projects/iot-wireless-mesh-daq/mesh/emulator.py"])
    child_procs.append(emulator_proc)

    print("[run_mesh-daq] mesh is running.")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        shutdown(signal.SIGINT, None)

if __name__ == "__main__":
    main()
