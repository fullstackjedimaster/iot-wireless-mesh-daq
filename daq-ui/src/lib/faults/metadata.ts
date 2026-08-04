import type { FaultMetadata } from "./types";

export const FAULTS_METADATA: Record<string, FaultMetadata> = {
    NORMAL: {
        label: "Normal",
        color: "#0aff02",
        priority: 0,
    },
    LOW_IRRADIANCE: {
        label: "Low Irradiance",
        threshold: 100,
        unit: "W/m²",
        color: "#64748b",
        priority: 0,
    },
    POSSIBLE_SHADING: {
        label: "Possible Shading",
        threshold: 0.75,
        unit: "performance_ratio",
        color: "#a855f7",
        priority: 1,
    },
    GROSS_POWER_DROP: {
        label: "Gross Power Drop",
        threshold: 0.5,
        unit: "performance_ratio",
        color: "#6d28d9",
        priority: 2,
    },
    OVER_TEMPERATURE: {
        label: "Over Temperature",
        threshold: 70,
        unit: "°C",
        color: "#f97316",
        priority: 2,
    },
    LOW_VOLTAGE: {
        label: "Low Voltage",
        threshold: 20,
        unit: "V",
        color: "#fa7115",
        priority: 1,
    },
    OPEN_CIRCUIT: {
        label: "Open Circuit",
        threshold: 0.02,
        unit: "projected_power_ratio",
        color: "#004aff",
        priority: 3,
    },
    SHORT_CIRCUIT: {
        label: "Short Circuit",
        threshold: 2,
        unit: "V",
        color: "#f10000",
        priority: 3,
    },
    DEAD_PANEL: {
        label: "Dead Panel",
        threshold: 1.5,
        unit: "V",
        color: "#5a5a5a",
        priority: 4,
    },
    UNKNOWN: {
        label: "Unknown",
        color: "#000000",
        priority: 0,
    },
};
