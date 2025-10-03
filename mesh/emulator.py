#!/usr/bin/env python3
import asyncio
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

comm_host = cfg['gateway']['comm_host']
comm_port = cfg['gateway']['comm_port']
ad_listen_port = cfg['gateway']['ad_listen_port']
ad_respond_port = cfg['gateway']['ad_respond_port']
ad_host = cfg['gateway'].get('ad_host', '0.0.0.0') or "0.0.0.0"

panel_delay = cfg['emulator'].get('panel_delay', 0.25)
cycle_delay = cfg['emulator'].get('cycle_delay', 0.5)

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
        """Broadcast MARCO until we get POLO back."""
        loop = asyncio.get_running_loop()
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.setblocking(False)

        try:
            s.bind(('', ad_respond_port))
        except Exception as e:
            print(f"[EMULATOR] Failed to bind UDP: {e}")
            s.close()
            return None

        marco = b"MARCO"
        target = ('<broadcast>', ad_listen_port)

        try:
            print(f"[EMULATOR] Broadcasting MARCO → {target}")
            await loop.sock_sendto(s, marco, target)
            data, addr = await asyncio.wait_for(loop.sock_recvfrom(s, 1024), timeout=2.0)
            if data.strip() == b"POLO":
                print(f"[EMULATOR] Received POLO from {addr}")
                s.close()
                return addr[0]
        except asyncio.TimeoutError:
            pass
        except Exception as e:
            print(f"[EMULATOR] Error during discovery: {e}")
        finally:
            s.close()

        return None

    async def connect(self, host):
        print(f"[EMULATOR] Connecting to {host}:{comm_port}...")
        self.reader, self.writer = await asyncio.open_connection(host, comm_port)
        print(f"[EMULATOR] Connected to {host}:{comm_port}")

    async def send_status_message(self, macaddr: str):
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
        # 🔁 Retry discovery until gateway responds
        siteserver_host = None
        while not siteserver_host:
            siteserver_host = await self.find_siteserver()
            if not siteserver_host:
                print("[EMULATOR] Siteserver not found. Retrying in 5s...")
                await asyncio.sleep(5)

        # Connect to gateway
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
