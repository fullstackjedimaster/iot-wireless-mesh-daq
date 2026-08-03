"""Solar panel environment and electrical telemetry simulator.

The emulator imports :class:`SolarPanelSimulator` directly.  It produces
irradiance (W/m²), panel temperature (°C), voltage, current and power while
keeping a small amount of per-panel state so readings move smoothly.
"""
from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class SolarSample:
    voltage: float
    current: float
    power: float
    temperature: float
    irradiance: float


class SolarPanelSimulator:
    """Generate plausible, smoothly varying photovoltaic panel readings."""

    def __init__(
        self,
        *,
        seed: int | None = None,
        nominal_vmp: float = 39.0,
        nominal_imp: float = 7.6,
        reference_irradiance: float = 1000.0,
        ambient_temperature: float = 25.0,
    ) -> None:
        self.random = random.Random(seed)
        self.nominal_vmp = nominal_vmp
        self.nominal_imp = nominal_imp
        self.reference_irradiance = reference_irradiance
        self.ambient_temperature = ambient_temperature
        self._phase = self.random.uniform(0.0, math.tau)
        self._cloud = self.random.uniform(0.82, 1.0)
        self._last_time = time.monotonic()

    def _environment(self) -> tuple[float, float]:
        now = time.monotonic()
        elapsed = max(0.0, now - self._last_time)
        self._last_time = now

        # Slowly move cloud cover rather than jumping between random values.
        self._cloud += self.random.uniform(-0.025, 0.025) * max(elapsed, 0.2)
        self._cloud = min(1.0, max(0.35, self._cloud))
        self._phase += 0.045 * max(elapsed, 0.2)

        solar_wave = 0.88 + 0.10 * math.sin(self._phase)
        irradiance = self.reference_irradiance * solar_wave * self._cloud
        irradiance += self.random.gauss(0.0, 8.0)
        irradiance = min(1200.0, max(120.0, irradiance))

        # A simple NOCT-like approximation: panel temperature rises with sun.
        panel_temperature = (
            self.ambient_temperature
            + 0.030 * irradiance
            + 1.4 * math.sin(self._phase / 2.0)
            + self.random.gauss(0.0, 0.18)
        )
        return irradiance, panel_temperature

    def sample(self, fault: str = "normal") -> SolarSample:
        irradiance, temperature = self._environment()
        irradiance_ratio = irradiance / self.reference_irradiance

        # Current follows irradiance; voltage has a smaller negative temperature
        # coefficient. These are intentionally simple demo relationships.
        current = self.nominal_imp * irradiance_ratio
        voltage = self.nominal_vmp * (1.0 - 0.0035 * (temperature - 25.0))
        current += self.random.gauss(0.0, 0.035)
        voltage += self.random.gauss(0.0, 0.08)

        if fault == "short_circuit":
            voltage = 0.0
            current = max(0.0, self.nominal_imp * 1.18 * irradiance_ratio)
        elif fault == "open_circuit":
            voltage = max(0.0, self.nominal_vmp * 1.22 * (1.0 - 0.0035 * (temperature - 25.0)))
            current = 0.0
        elif fault == "low_voltage":
            voltage *= 0.58
            current *= 0.92
        elif fault == "dead_panel":
            voltage = 0.0
            current = 0.0

        voltage = max(0.0, voltage)
        current = max(0.0, current)
        power = voltage * current

        return SolarSample(
            voltage=round(voltage, 2),
            current=round(current, 2),
            power=round(power, 2),
            temperature=round(temperature, 2),
            irradiance=round(irradiance, 1),
        )
