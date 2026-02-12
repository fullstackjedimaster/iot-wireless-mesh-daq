#!/usr/bin/env python3
import asyncio
import os
import random
import socket

from DAQ.commands.protocol import Message, DataIndication
from DAQ.util.utctime import utcepochnow
from DAQ.util.config import load_config
from DAQ.util.faults import get_fault  # ✅ Fault injection support

# -------------------------
# Config
# -------------------------
cfg = load_config()

comm_host = cfg["gateway"]["comm_host"]
comm_port = cfg["gateway"]["comm_port"]
ad_listen_port = cfg["gateway"]["ad_listen_port"]
ad_respond_port = cfg["gateway"]["ad_respond_port"]
ad_host = cfg["gateway"].get("ad_host", "0.0.0.0") or "0.0.0.0"

panel_delay = cfg["emulator"].get("panel_delay", 0.25)
cycle_delay = cfg["emulator"].get("cycle_delay", 0.5)

PANEL_MACS = [
    "fa:29:eb:6d:87:01",
    "fa:29:eb:6d:87:02",
    "fa:29:eb:6d:87:03",
    "fa:29:eb:6d:87:04",
]

FAULTS = {
    "short_circuit": None,
    "open_circuit": None,
    "low_voltage": None,
    "dead_panel": None,
    "normal": None,
}
FAULTS_KEYS = list(FAULTS.keys())


# -------------------------
# Helpers
# -------------------------
def _in_docker() -> bool:
    """
    Best-effort detection for Docker/container environments.
    Works for Docker, many OCI runtimes, and typical compose setups.
    """
    if os.path.exists("/.dockerenv"):
        return True
    try:
        with open("/proc/1/cgroup", "rt", encoding="utf-8", errors="ignore") as f:
            s = f.read()
        return ("docker" in s) or ("containerd" in s) or ("kubepods" in s)
    except Exception:
        return False


def _direct_host() -> str:
    """
    Decide what host to connect to when bypassing UDP broadcast discovery.

    Priority:
      1) ENV override: MESH_GATEWAY_HOST
      2) config override: emulator.gateway_host
      3) default Docker DNS name: "mesh"
    """
    env = (os.getenv("MESH_GATEWAY_HOST") or "").strip()
    if env:
        return env

    cfg_host = (cfg.get("emulator", {}).get("gateway_host") or "").strip()
    if cfg_host:
        return cfg_host

    return "mesh"


# -------------------------
# Fault Profile Generator
# -------------------------
def generate_profile(macaddr: str):
    fault = get_fault(macaddr.lower())
    if fault == "random":
        fault = random.choice(FAULTS_KEYS)

    if fault == "short_circuit":
        Vi, Ii = 0.0, random.uniform(91.0, 100.0)
    elif fault == "open_circuit":
        Vi, Ii = random.uniform(96.0, 100.0), 0.0
    elif fault == "low_voltage":
        Vi, Ii = random.uniform(18.0, 24.0), random.uniform(6.0, 7.5)
    elif fault == "dead_panel":
        Vi, Ii = 0.0, 0.0
    else:  # normal (default)
        Vi, Ii = random.uniform(38.0, 40.0), random.uniform(7.0, 8.0)

    Pi = round(Vi * Ii, 2)
    return {
        "voltage": round(Vi, 2),
        "current": round(Ii, 2),
        "power": Pi,
        "status": fault or "normal",
    }


# -------------------------
# Emulator Core
# -------------------------
class AsyncEmulator:
    def __init__(self):
        self.start_time = utcepochnow()
        self.reader = None
        self.writer = None

    async def find_siteserver(self):
        """Broadcast MARCO until we get POLO back.
        Automatically switches to localhost if the responder is on the same host."""
        loop = asyncio.get_running_loop()
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.setblocking(False)

        try:
            s.bind(("0.0.0.0", ad_respond_port))
        except Exception as e:
            print(f"[EMULATOR] Failed to bind UDP socket: {e}")
            s.close()
            return None

        marco = b"MARCO"
        target = ("255.255.255.255", ad_listen_port)

        try:
            print(f"[EMULATOR] Broadcasting MARCO → {target}")
            await loop.sock_sendto(s, marco, target)
            data, addr = await asyncio.wait_for(loop.sock_recvfrom(s, 1024), timeout=5.0)

            if data.strip() == b"POLO":
                responder_ip = addr[0]
                print(f"[EMULATOR] Received POLO from {addr}")

                # --- Detect if this IP belongs to a local interface ---
                local_ips = set()
                try:
                    host_name = socket.gethostname()
                    local_ips.add(socket.gethostbyname(host_name))
                    for info in socket.getaddrinfo(host_name, None):
                        local_ips.add(info[4][0])
                    # Always include localhost variants
                    local_ips.update({"127.0.0.1", "0.0.0.0"})
                except Exception as e:
                    print(f"[EMULATOR] Could not enumerate local IPs: {e}")

                if responder_ip in local_ips or responder_ip.startswith("127."):
                    print(f"[EMULATOR] Detected local gateway ({responder_ip}) → forcing 127.0.0.1 for TCP")
                    responder_ip = "127.0.0.1"

                s.close()
                return responder_ip

        except asyncio.TimeoutError:
            print("[EMULATOR] No POLO received (timeout)")
        except Exception as e:
            print(f"[EMULATOR] Error during discovery: {e}")
        finally:
            s.close()

        return None

    async def connect(self, host: str):
        print(f"[EMULATOR] Connecting to {host}:{comm_port}...")
        self.reader, self.writer = await asyncio.open_connection(host, comm_port)
        print(f"[EMULATOR] Connected to {host}:{comm_port}")

    async def send_status_message(self, macaddr: str):
        if not self.writer:
            return

        profile = generate_profile(macaddr)
        Vi, Ii, Pi = profile["voltage"], profile["current"], profile["power"]
        timestamp = utcepochnow() - self.start_time

        msg = Message()
        try:
            mac_clean = macaddr.replace(":", "").strip().lower()
            if len(mac_clean) != 12:
                print(f"[ERROR] MAC {mac_clean} is not 6 bytes")
                return
            msg.set_addr(mac_clean)
        except Exception as e:
            print(f"[ERROR] Invalid MAC '{macaddr}': {e}")
            return

        msg.request_id = random.randint(0, 0xFFFF)
        msg.source_hopcount = random.randint(1, 10)
        msg.source_queue_length = 0
        msg.dtype = Message.TYPE_PLM

        cmd = DataIndication()
        cmd.add_data(timestamp, Vi, Vi, Ii, Ii, Pi, Pi)
        msg.add_command(cmd)

        payload = msg.decompile()
        if len(payload) > 255:
            print(f"[SKIP] Payload too large: {len(payload)} bytes")
            return

        message = b"MI" + bytes([len(payload)]) + payload
        self.writer.write(message)
        await self.writer.drain()

        print(f"[EMULATOR] Sent: MAC={mac_clean} V={Vi:.2f} I={Ii:.2f} P={Pi:.2f}")

    async def run(self):
        # -----------------------------
        # Option A: Docker/direct mode
        # -----------------------------
        # In Docker, UDP broadcast discovery is unreliable. Use deterministic host.
        force_direct = (os.getenv("MESH_FORCE_DIRECT", "").strip() == "1")
        if force_direct or _in_docker():
            host = _direct_host()
            print(f"[EMULATOR] Direct-connect mode (docker={_in_docker()} force={force_direct}) → {host}:{comm_port}")

            # Keep retrying until gateway is up
            while True:
                try:
                    await self.connect(host)
                    break
                except Exception as e:
                    print(f"[EMULATOR] Direct connect failed: {e}. Retrying in 3s...")
                    await asyncio.sleep(3)

        else:
            # -----------------------------
            # LAN mode: broadcast discovery
            # -----------------------------
            siteserver_host = None
            while not siteserver_host:
                siteserver_host = await self.find_siteserver()
                if not siteserver_host:
                    print("[EMULATOR] Siteserver not found. Retrying in 5s...")
                    await asyncio.sleep(5)

            await self.connect(siteserver_host)

        # Main loop: broadcast panel telemetry
        try:
            while True:
                for mac in PANEL_MACS:
                    await self.send_status_message(mac)
                    await asyncio.sleep(panel_delay)
                await asyncio.sleep(cycle_delay)
        except asyncio.CancelledError:
            print("[EMULATOR] Cancelled.")
        except Exception as e:
            print(f"[EMULATOR] Exception: {e}")
        finally:
            print("[EMULATOR] Shutting down...")
            if self.writer:
                self.writer.close()
                await self.writer.wait_closed()


# -------------------------
# Entrypoint
# -------------------------
if __name__ == "__main__":
    async def main():
        emulator = AsyncEmulator()
        await emulator.run()

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[EMULATOR] Interrupted.")

