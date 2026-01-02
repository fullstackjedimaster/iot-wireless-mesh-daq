from .config import get_redis_conn

FAULTS_METADATA = {
    "OPEN_CIRCUIT": {
        "description": "Panel is receiving light but producing little or no power.",
        "thresholds": {
            "Po_mean_ratio": "< 0.02",
            "irradiance_mean": "> 400"
        },
        "severity": "high",
        "diagnosis": "Power output is near zero despite adequate irradiance, indicating an electrical disconnect or broken connection."
    },
    "SNAPPED_DIODE": {
        "description": "Panel diode failure affecting output voltage pattern.",
        "thresholds": {
            "Vo_offset_step": "~3.5% increments",
            "diode_count": "1-3 typically"
        },
        "severity": "moderate",
        "diagnosis": "Voltage deviates from inverter by stepwise percentages; snapped diode likely if deviation matches multiple."
    },
    "POWER_DROP": {
        "description": "Noticeable power drop not attributed to open circuit or diode issues.",
        "thresholds": {
            "percent_loss": "< 95"
        },
        "severity": "medium",
        "diagnosis": "Output loss exceeds normal variation; may indicate shading, string issues, or degradation."
    },
    "DEAD_PANEL": {
        "description": "Average panel voltage is too low to function.",
        "thresholds": {
            "avg_voltage": "< 1.5"
        },
        "severity": "critical",
        "diagnosis": "Voltage below operational minimum; panel is likely not contributing any power."
    },
    "LOW_VOLTAGE": {
        "description": "Operating voltage below acceptable system range.",
        "thresholds": {
            "voltage": "< 20"
        },
        "severity": "low",
        "diagnosis": "Low voltage may indicate bad wiring, load mismatch, or environmental loss."
    },
    "LOW_POWER": {
        "description": "Panel is producing very little power.",
        "thresholds": {
            "power": "< 10"
        },
        "severity": "low",
        "diagnosis": "Insufficient output — possibly from shading, dirt, or degradation."
    },
    "GROSS_POWER_DROP": {
        "description": "Severe output drop, possibly environmental.",
        "thresholds": {
            "percent_loss": "> 50"
        },
        "severity": "high",
        "diagnosis": "Major loss in performance often due to system fault or poor weather."
    },
    "SHADING": {
        "description": "Intermittent or irregular output linked to shade patterns.",
        "thresholds": {
            "pattern": "clustered loss events"
        },
        "severity": "variable",
        "diagnosis": "May indicate obstruction or seasonal shade near the panel."
    },
    "INVERTER_OFFLINE": {
        "description": "Inverter communication has dropped.",
        "thresholds": {
            "heartbeat_miss": "> 30 mins"
        },
        "severity": "critical",
        "diagnosis": "Data not being received from inverter — it may be powered off or disconnected."
    },
    "STRING_OFFLINE": {
        "description": "String of panels not reporting data.",
        "thresholds": {
            "heartbeat_miss": "> 30 mins"
        },
        "severity": "critical",
        "diagnosis": "Likely wiring or device-level outage across string path."
    }
}


def set_fault(mac: str, fault: str):
    r = get_redis_conn(db=3)
    mac = mac.lower()
    r.set(f"fault_injection:{mac}", fault)

def get_fault(mac: str) -> str:
    r = get_redis_conn(db=3)
    mac = mac.lower()
    val = r.get(f"fault_injection:{mac}")
    if val:
        return val.decode("utf-8")
    return "normal"

def reset_fault(mac: str):
    r = get_redis_conn(db=3)
    mac = mac.lower()
    r.delete(f"fault_injection:{mac}")


def generate_profile(faults: list[dict]) -> dict:
    """
    Generate a status profile summary from raw fault entries.
    """
    profile = {fault_type: 0 for fault_type in FAULTS_METADATA}
    for fault in faults:
        fault_type = fault.get("type")
        if fault_type in profile:
            profile[fault_type] += 1
    return profile

def compute_status(profile: dict) -> str:
    """
    Derive overall system status from the fault profile using metadata priorities.
    """
    if not profile:
        return "normal"

    priority_order = sorted(
        FAULTS_METADATA.items(),
        key=lambda item: item[1].get("severity", 0),
        reverse=True
    )

    for fault_type, meta in priority_order:
        count = profile.get(fault_type, 0)
        if count > 0:
            return fault_type
    return "normal"

def compute_status_from_metrics(voltage: float, current: float) -> str:
    try:
        v = float(voltage)
        i = float(current)
    except (ValueError, TypeError):
        return "unknown"

    if v == 0.0 and i > 90.0:
        return "short_circuit"
    if v > 95.0 and i == 0.0:
        return "open_circuit"
    if 15.0 < v < 26.0:
        return "low_voltage"
    if v == 0.0 and i == 0.0:
        return "dead_panel"
    return "normal"

def normalize_fault_token(token: str) -> tuple[str, str]:
    """
    Returns (lowercase_for_emulator, uppercase_for_profile)
    Accepts 'low_voltage' / 'LOW_VOLTAGE' / 'Low Voltage' etc.
    """
    if not isinstance(token, str):
        return "normal", "NORMAL"
    t = token.strip().replace(" ", "_").lower()
    # whitelist known codes
    known = {
        "short_circuit", "open_circuit", "low_voltage",
        "dead_panel", "power_drop", "low_power", "random", "reset", "normal"
    }
    if t == "reset":
        t = "normal"
    if t not in known:
        t = "normal"
    return t, t.upper()
