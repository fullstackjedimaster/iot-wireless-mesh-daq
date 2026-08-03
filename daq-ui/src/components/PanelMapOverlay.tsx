// /daq-ui/src/components/PanelMapOverlay.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getLayout, getPanelStatus } from "@/lib/api";

interface PanelInfo {
    mac: string;
    x: number;
    y: number;
}

type RawPanelData = {
    voltage?: number;
    current?: number;
    power?: number;
    temperature?: number;
    irradiance?: number;
    expected_power?: number;
    performance_ratio?: number;
    environmental_state?: string;
    diagnostic_basis?: string;
    status?: string;
};

interface Props {
    selectedMac: string;
    onPanelClick: (mac: string) => void;
    onSelectionMeta?: (mac: string, telem: PanelTelemetry) => void;
}

export type PanelTelemetry = {
    voltage?: string;
    current?: string;
    power?: string;
    temperature?: string;
    irradiance?: string;
    status?: string;
};

const statusColorMap: Record<string, string> = {
    normal: "#0aff02",
    low_voltage: "#fa7115",
    dead_panel: "#5a5a5a",
    short_circuit: "#f10000",
    open_circuit: "#004aff",
    unknown: "#000000",
};

function toFiniteNumber(value: unknown): number | undefined {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function toTelemetry(raw: RawPanelData | undefined, fallbackStatus?: string): PanelTelemetry {
    return {
        status: raw?.status ?? fallbackStatus,
        voltage: raw?.voltage !== undefined ? String(raw.voltage) : undefined,
        current: raw?.current !== undefined ? String(raw.current) : undefined,
        power: raw?.power !== undefined ? String(raw.power) : undefined,
        temperature: raw?.temperature !== undefined ? String(raw.temperature) : undefined,
        irradiance: raw?.irradiance !== undefined ? String(raw.irradiance) : undefined,
        expected_power: raw?.expected_power !== undefined ? String(raw.expected_power) : undefined,
        performance_ratio: raw?.performance_ratio !== undefined ? String(raw.performance_ratio) : undefined,
        environmental_state: raw?.environmental_state,
        diagnostic_basis: raw?.diagnostic_basis,
    };
}

export default function PanelMapOverlay({ selectedMac, onPanelClick, onSelectionMeta }: Props) {
    const [layout, setLayout] = useState<PanelInfo[]>([]);
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [rawByMac, setRawByMac] = useState<Record<string, RawPanelData | undefined>>({});

    const layoutHashRef = useRef("");
    const statusHashRef = useRef("");

    useEffect(() => {
        let mounted = true;
        const fetchLayoutOnce = async () => {
            try {
                const data = await getLayout();
                const nextHash = JSON.stringify(data);
                if (mounted && nextHash !== layoutHashRef.current) {
                    layoutHashRef.current = nextHash;
                    setLayout((data as PanelInfo[]) ?? []);
                }
            } catch {}
        };
        void fetchLayoutOnce();
        const interval = window.setInterval(fetchLayoutOnce, 5000);
        return () => {
            mounted = false;
            window.clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (layout.length === 0) return;
        let mounted = true;

        const fetchStatuses = async () => {
            try {
                const results = await Promise.all(
                    layout.map(async (panel) => {
                        try {
                            const response = await getPanelStatus(panel.mac);
                            const raw: RawPanelData = {
                                status: response?.status !== undefined ? String(response.status).toLowerCase() : undefined,
                                voltage: toFiniteNumber(response?.voltage),
                                current: toFiniteNumber(response?.current),
                                power: toFiniteNumber(response?.power),
                                temperature: toFiniteNumber(response?.temperature),
                                irradiance: toFiniteNumber(response?.irradiance),
                                expected_power: toFiniteNumber(response?.expected_power),
                                performance_ratio: toFiniteNumber(response?.performance_ratio),
                                environmental_state: response?.environmental_state !== undefined ? String(response.environmental_state) : undefined,
                                diagnostic_basis: response?.diagnostic_basis !== undefined ? String(response.diagnostic_basis) : undefined,
                            };
                            return [panel.mac, { status: raw.status ?? "unknown", raw }] as const;
                        } catch {
                            return [panel.mac, { status: "unknown", raw: undefined }] as const;
                        }
                    }),
                );

                if (!mounted) return;

                const nextStatuses = Object.fromEntries(
                    results.map(([mac, payload]) => [mac, payload.status]),
                );
                const nextRaw = Object.fromEntries(
                    results.map(([mac, payload]) => [mac, payload.raw]),
                );
                const nextStatusHash = JSON.stringify(nextStatuses);

                if (nextStatusHash !== statusHashRef.current) {
                    statusHashRef.current = nextStatusHash;
                    setStatuses(nextStatuses);
                }
                setRawByMac(nextRaw);
            } catch {}
        };

        void fetchStatuses();
        const interval = window.setInterval(fetchStatuses, 5000);
        return () => {
            mounted = false;
            window.clearInterval(interval);
        };
    }, [layout]);

    useEffect(() => {
        if (!selectedMac) return;
        onSelectionMeta?.(
            selectedMac,
            toTelemetry(rawByMac[selectedMac], statuses[selectedMac] ?? "unknown"),
        );
    }, [selectedMac, statuses, rawByMac, onSelectionMeta]);

    const cellWidth = 50;
    const cellHeight = 15;
    const panelWidth = 45;
    const panelHeight = 10;

    const { svgWidth, svgHeight } = useMemo(() => {
        const maxX = layout.length ? Math.max(...layout.map((panel) => panel.x)) : 1;
        const maxY = layout.length ? Math.max(...layout.map((panel) => panel.y)) : 1;
        return {
            svgWidth: Math.max(maxX, 1) * cellWidth,
            svgHeight: Math.max(maxY, 1) * cellHeight,
        };
    }, [layout]);

    return (
        <div className="panel-section">
            <svg
                width="100%"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-auto"
            >
                {layout.map((panel) => {
                    const status = statuses[panel.mac] ?? "unknown";
                    const color = statusColorMap[status] ?? "#6b7280";
                    const isSelected = selectedMac === panel.mac;
                    const centerX = (panel.x - 1) * cellWidth + cellWidth / 2;
                    const centerY = (panel.y - 1) * cellHeight + cellHeight / 2;

                    return (
                        <g
                            key={panel.mac}
                            onClick={() => {
                                onPanelClick(panel.mac);
                                onSelectionMeta?.(
                                    panel.mac,
                                    toTelemetry(rawByMac[panel.mac], status),
                                );
                            }}
                            className="panel cursor-pointer"
                        >
                            <rect
                                x={centerX - panelWidth / 2}
                                y={centerY - panelHeight / 2}
                                width={panelWidth}
                                height={panelHeight}
                                rx={6}
                                fill={color}
                                stroke={isSelected ? "#000" : "none"}
                                strokeWidth={isSelected ? 2 : 0}
                            />
                            <text
                                x={centerX}
                                y={centerY}
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className="panel-label select-none"
                                fill="#000"
                            >
                                {panel.mac}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
