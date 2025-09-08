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

type RawPanelData = {
    voltage?: number;
    current?: number;
    status?: string;
};

interface Props {
    selectedMac: string;
    onPanelClick: (mac: string) => void;
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

// ---- Dock messaging ----
const DOCK_FRAME_ID = "iframe-1";
function postToDock(msg: unknown) {
    const iframe = document.getElementById(DOCK_FRAME_ID) as HTMLIFrameElement | null;
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(msg, "*");
}
function sendSelectedToDock(mac: string, telem: PanelTelemetry) {
    // Use the most-capable format the dock understands
    postToDock({ type: "SET_SELECTED", id: mac, attrs: telem });
    // Back-compat payload (dock also accepts this)
    postToDock({ type: "PANEL_SELECTED", mac, telemetry: telem });
}

export const PanelMapOverlay: React.FC<Props> = ({
                                                     selectedMac,
                                                     onPanelClick,
                                                     onSelectionMeta,
                                                 }) => {
    const [layout, setLayout] = useState<PanelInfo[]>([]);
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [rawByMac, setRawByMac] = useState<Record<string, RawPanelData | undefined>>({});

    const layoutHashRef = useRef<string>("");
    const statusHashRef = useRef<string>("");

    // Poll layout
    useEffect(() => {
        let isMounted = true;
        const fetchLayoutOnce = async () => {
            try {
                const data = await getLayout();
                const nextHash = JSON.stringify(data);
                if (isMounted && nextHash !== layoutHashRef.current) {
                    layoutHashRef.current = nextHash;
                    setLayout((data as PanelInfo[]) ?? []);
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

    // Poll statuses
    useEffect(() => {
        if (layout.length === 0) return;
        let isMounted = true;

        const fetchStatuses = async () => {
            try {
                const results = await Promise.all(
                    layout.map(async (panel) => {
                        try {
                            const rawResp = await getPanelStatus(panel.mac);

                            const voltageNum = Number(rawResp?.voltage);
                            const currentNum = Number(rawResp?.current);

                            const raw: RawPanelData = {
                                status:
                                    rawResp?.status !== undefined
                                        ? String(rawResp.status).toLowerCase()
                                        : undefined,
                                voltage: Number.isFinite(voltageNum) ? voltageNum : undefined,
                                current: Number.isFinite(currentNum) ? currentNum : undefined,
                            };

                            const status = raw.status ?? "unknown";
                            return [panel.mac, { status, raw }] as const;
                        } catch {
                            return [panel.mac, { status: "unknown", raw: undefined }] as const;
                        }
                    })
                );

                const nextStatuses: Record<string, string> = Object.fromEntries(
                    results.map(([mac, payload]) => [mac, payload.status])
                );
                const nextHash = JSON.stringify(nextStatuses);

                if (isMounted && nextHash !== statusHashRef.current) {
                    statusHashRef.current = nextHash;
                    setStatuses(nextStatuses);

                    const nextRaw: Record<string, RawPanelData | undefined> = { ...rawByMac };
                    for (const [mac, payload] of results) nextRaw[mac] = payload.raw;
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

    // Emit telemetry for selected MAC (host callbacks + dock)
    useEffect(() => {
        if (!selectedMac) return;
        const raw = rawByMac[selectedMac];
        const telem: PanelTelemetry = {
            status: statuses[selectedMac] ?? "unknown",
            voltage: raw?.voltage !== undefined ? String(raw.voltage) : undefined,
            current: raw?.current !== undefined ? String(raw.current) : undefined,
        };
        onSelectionMeta?.(selectedMac, telem);
        // Also forward to dock
        sendSelectedToDock(selectedMac, telem);
    }, [selectedMac, statuses, rawByMac, onSelectionMeta]);

    // Layout constants
    const cellWidth = 50;
    const cellHeight = 15;
    const panelWidth = 45;
    const panelHeight = 10;

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
                                const raw = rawByMac[panel.mac];
                                const telem: PanelTelemetry = {
                                    status,
                                    voltage: raw?.voltage !== undefined ? String(raw.voltage) : undefined,
                                    current: raw?.current !== undefined ? String(raw.current) : undefined,
                                };
                                onSelectionMeta?.(panel.mac, telem);
                                sendSelectedToDock(panel.mac, telem);
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
