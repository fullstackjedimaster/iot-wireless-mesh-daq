from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from .config import get_redis_conn

RATED_POWER_W = 292.5
TEMP_COEFFICIENT_PER_C = -0.004

FAULTS_METADATA = {
    "DEAD_PANEL": {"description": "Panel is not producing usable voltage or current despite adequate irradiance.", "severity": "critical", "priority": 4},
    "OPEN_CIRCUIT": {"description": "Panel voltage is present but current and power are near zero under adequate irradiance.", "severity": "high", "priority": 3},
    "SHORT_CIRCUIT": {"description": "Panel voltage has collapsed while current remains abnormally high.", "severity": "high", "priority": 3},
    "OVER_TEMPERATURE": {"description": "Panel temperature exceeds the configured safe operating warning threshold.", "severity": "moderate", "priority": 2},
    "GROSS_POWER_DROP": {"description": "Measured power is less than half of the irradiance- and temperature-adjusted expectation.", "severity": "high", "priority": 2},
    "POSSIBLE_SHADING": {"description": "Power is materially below expectation while irradiance remains sufficient.", "severity": "medium", "priority": 1},
    "LOW_VOLTAGE": {"description": "Panel voltage is below the expected operating range under useful irradiance.", "severity": "low", "priority": 1},
    "LOW_IRRADIANCE": {"description": "Available sunlight is too low for meaningful electrical fault diagnosis.", "severity": "informational", "priority": 0},
    "NORMAL": {"description": "Telemetry is consistent with normal irradiance- and temperature-adjusted operation.", "severity": "normal", "priority": 0},
    "UNKNOWN": {"description": "Telemetry was missing or invalid.", "severity": "unknown", "priority": 0},
}

SUPPORTED_INJECTION_FAULTS = {
    "short_circuit",
    "open_circuit",
    "low_voltage",
    "dead_panel",
    "over_temperature",
    "gross_power_drop",
    "possible_shading",
    "low_irradiance",
    "random",
    "normal",
}

@dataclass(frozen=True)
class FaultAssessment:
    status: str
    expected_power: float
    performance_ratio: float
    diagnostic_basis: str
    environmental_state: str


def _float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def expected_power_w(irradiance: float, temperature: float) -> float:
    irradiance_factor = max(0.0, min(1.25, irradiance / 1000.0))
    temperature_factor = max(0.55, min(1.12, 1.0 + TEMP_COEFFICIENT_PER_C * (temperature - 25.0)))
    return max(0.0, RATED_POWER_W * irradiance_factor * temperature_factor)


def assess_metrics(
    voltage: float,
    current: float,
    power: float,
    temperature: float,
    irradiance: float,
) -> FaultAssessment:
    v, i, p, t, g = map(_float, (voltage, current, power, temperature, irradiance))
    expected = expected_power_w(g, t)
    ratio = p / expected if expected > 1.0 else 0.0
    environment = "low_irradiance" if g < 100.0 else "productive_irradiance"

    def result(status: str, basis: str) -> FaultAssessment:
        return FaultAssessment(status, round(expected, 2), round(ratio, 3), basis, environment)

    if g < 100.0:
        return result("low_irradiance", "Irradiance below 100 W/m²; electrical fault diagnosis is suppressed.")
    if g >= 400.0 and v <= 1.5 and i <= 0.15:
        return result("dead_panel", "Voltage and current are both near zero despite adequate irradiance.")
    if g >= 400.0 and v <= 2.0 and i >= 5.0:
        return result("short_circuit", "Voltage collapsed while current remained high under adequate irradiance.")
    if g >= 400.0 and v >= 25.0 and i <= 0.15 and p <= max(5.0, expected * 0.02):
        return result("open_circuit", "Voltage is present but current and power are near zero under adequate irradiance.")
    if t >= 70.0:
        return result("over_temperature", "Panel temperature is at or above 70 °C.")
    if g >= 300.0 and expected >= 25.0 and ratio < 0.50:
        return result("gross_power_drop", "Power is below 50% of the irradiance- and temperature-adjusted expectation.")
    if g >= 400.0 and expected >= 25.0 and ratio < 0.75:
        return result("possible_shading", "Power is below 75% of expectation while irradiance remains sufficient.")
    if g >= 200.0 and 1.5 < v < 20.0:
        return result("low_voltage", "Voltage is below 20 V under useful irradiance.")
    return result("normal", "Measurements are within the expected solar operating envelope.")


def compute_status_from_metrics(
    voltage: float,
    current: float,
    power: float = 0.0,
    temperature: float = 25.0,
    irradiance: float = 0.0,
) -> str:
    return assess_metrics(voltage, current, power, temperature, irradiance).status


def assessment_dict(*args: Any, **kwargs: Any) -> dict[str, Any]:
    return asdict(assess_metrics(*args, **kwargs))


def set_fault(mac: str, fault: str):
    get_redis_conn(db=3).set(f"fault_injection:{mac.lower()}", fault)


def get_fault(mac: str) -> str:
    value = get_redis_conn(db=3).get(f"fault_injection:{mac.lower()}")
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value) if value else "normal"


def reset_fault(mac: str):
    get_redis_conn(db=3).delete(f"fault_injection:{mac.lower()}")


def normalize_fault_token(token: str) -> tuple[str, str]:
    if not isinstance(token, str):
        return "normal", "NORMAL"
    normalized = token.strip().replace(" ", "_").lower()
    if normalized == "reset":
        normalized = "normal"
    if normalized not in SUPPORTED_INJECTION_FAULTS:
        normalized = "normal"
    return normalized, normalized.upper()


def generate_profile(faults: list[dict]) -> dict:
    profile = {name: 0 for name in FAULTS_METADATA}
    for fault in faults:
        name = str(fault.get("type", "UNKNOWN")).upper()
        if name in profile:
            profile[name] += 1
    return profile


def compute_status(profile: dict) -> str:
    active = [(name, FAULTS_METADATA[name]["priority"]) for name, count in profile.items() if count and name in FAULTS_METADATA]
    return max(active, key=lambda item: item[1])[0].lower() if active else "normal"
