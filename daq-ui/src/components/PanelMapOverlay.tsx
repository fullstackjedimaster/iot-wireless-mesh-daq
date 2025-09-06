// /daq-ui/src/components/PanelMapOverlay.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getLayout, getPanelStatus } from "@/lib/api";

interface PanelInfo {
    mac: string;
    x: number;
    y: number;
}

export type PanelTelemetry = {
    voltage?: string;
    current?: string;
    status?: string;
};

interface Props {
    selectedMac: string;
    onPanelClick: (mac: string) => void;

    /**
     * Optional callback: whenever this component learns new telemetry
     * for the *currently selected* MAC, report it upward.
     */
    onSelectionMeta?: (mac: string, telem: PanelTelemetry) => void;
}

const statusColorMap: Record<string, string> = {
    normal: "#0aff02",
    low_voltage: "#fa7115",
    dead_panel: "#5a5a5a",
    short_circuit: "#f10000",
    open_circuit: "#004aff",
    unknown: "#000000",
};

export const PanelMapOverlay: React.FC<Props> = ({
                                                     selectedMac,
                                                     onPanelClick,
                                                     onSelectionMeta,
                                                 }) => {
    const [layout, setLayout] = useState<PanelInfo[]>([]);
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [rawByMac, setRawByMac] = useState<Record<string, any>>({}); // store last raw result per MAC

    // Hash refs so we only update state when data actually changes
    const layoutHashRef = useRef<string>("");
    const statusHashRef = useRef<string>("");

    // Poll layout every 5s, but only set state if payload changed
    useEffect(() => {
        let isMounted = true;

        const fetchLayoutOnce = async () => {
            try {
                const data = await getLayout();
                const nextHash = JSON.stringify(data);
                if (isMounted && nextHash !== layoutHashRef.current) {
                    layoutHashRef.current = nextHash;
                    setLayout(data as PanelInfo[]);
                }
            } catch {
                /* ignore */
            }
        };

        void fetchLayoutOnce();
        const id = setInterval(fetchLayoutOnce, 5000);
        return () => {
            isMounted = false;
            clearInterval(id);
        };
    }, []);

    // Poll statuses for the current layout every 5s (in parallel), update only on change
    useEffect(() => {
        if (layout.length === 0) return;
        let isMounted = true;

        const fetchStatuses = async () => {
            try {
                const results = await Promise.all(
                    layout.map(async (panel) => {
                        try {
                            const raw = await getPanelStatus(panel.mac);
                            // normalize
                            const status = String(raw?.status ?? "unknown").toLowerCase();
                            return [panel.mac, { status, raw }] as const;
                        } catch {
                            return [panel.mac, { status: "unknown", raw: null }] as const;
                        }
                    })
                );

                const nextStatuses: Record<string, string> = Object.fromEntries(
                    results.map(([mac, { status }]) => [mac, status])
                );
                const nextHash = JSON.stringify(nextStatuses);

                if (isMounted && nextHash !== statusHashRef.current) {
                    statusHashRef.current = nextHash;
                    setStatuses(nextStatuses);

                    // keep last raw result per MAC too (for voltage/current forwarding)
                    const nextRaw: Record<string, any> = { ...rawByMac };
                    for (const [mac, { raw }] of results) nextRaw[mac] = raw;
                    setRawByMac(nextRaw);
                }
            } catch {
                /* ignore */
            }
        };

        void fetchStatuses();
        const id = setInterval(fetchStatuses, 5000);
        return () => {
            isMounted = false;
            clearInterval(id);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layout]);

    // When the *selected* MAC changes or when status/raw updates, inform parent with latest telemetry
    useEffect(() => {
        if (!selectedMac) return;
        const raw = rawByMac[selectedMac];
        const telem: PanelTelemetry = {
            status: statuses[selectedMac] ?? "unknown",
            voltage: raw?.voltage != null ? String(raw.voltage) : undefined,
            current: raw?.current != null ? String(raw.current) : undefined,
        };
        onSelectionMeta?.(selectedMac, telem);
    }, [selectedMac, statuses, rawByMac, onSelectionMeta]);

    // Layout constants
    const cellWidth = 50;
    const cellHeight = 15;
    const panelWidth = 45;
    const panelHeight = 10;

    // Compute SVG size safely (handles empty layout)
    const { svgWidth, svgHeight } = useMemo(() => {
        const maxX = layout.length ? Math.max(...layout.map((p) => p.x)) : 1;
        const maxY = layout.length ? Math.max(...layout.map((p) => p.y)) : 1;
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

                    const cx = (panel.x - 1) * cellWidth + cellWidth / 2;
                    const cy = (panel.y - 1) * cellHeight + cellHeight / 2;

                    return (
                        <g
                            key={panel.mac}
                            onClick={() => {
                                onPanelClick(panel.mac);
                                // Best effort: if we already have raw for this mac, push immediately
                                const raw = rawByMac[panel.mac];
                                const telem: PanelTelemetry = {
                                    status,
                                    voltage: raw?.voltage != null ? String(raw.voltage) : undefined,
                                    current: raw?.current != null ? String(raw.current) : undefined,
                                };
                                onSelectionMeta?.(panel.mac, telem);
                            }}
                            className="panel cursor-pointer"
                        >
                            <rect
                                x={cx - panelWidth / 2}
                                y={cy - panelHeight / 2}
                                width={panelWidth}
                                height={panelHeight}
                                rx={6}
                                fill={color}
                                stroke={isSelected ? "#000" : "none"}
                                strokeWidth={isSelected ? 2 : 0}
                            />
                            <text
                                x={cx}
                                y={cy}
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
};
