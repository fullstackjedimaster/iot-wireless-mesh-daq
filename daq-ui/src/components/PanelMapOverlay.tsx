// /daq-ui/src/components/PanelMapOverlay.tsx
"use client";

import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

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
    onSelectionMeta?: (
        mac: string,
        telemetry: PanelTelemetry,
    ) => void;
}

export type PanelTelemetry = {
    voltage?: string;
    current?: string;
    power?: string;
    temperature?: string;
    irradiance?: string;
    expected_power?: string;
    performance_ratio?: string;
    environmental_state?: string;
    diagnostic_basis?: string;
    status?: string;
};

const statusColorMap: Record<string, string> = {
    normal: "#0aff02",
    low_irradiance: "#64748b",
    possible_shading: "#a855f7",
    gross_power_drop: "#6d28d9",
    over_temperature: "#f97316",
    low_voltage: "#fa7115",
    dead_panel: "#5a5a5a",
    short_circuit: "#f10000",
    open_circuit: "#004aff",
    unknown: "#000000",
};

const CABLE_COLOR = "#111111";
const CABLE_HIGHLIGHT = "#3f3f46";

function toFiniteNumber(
    value: unknown,
): number | undefined {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function serializeNumber(
    value: number | undefined,
): string | undefined {
    return value !== undefined ? String(value) : undefined;
}

function toTelemetry(
    raw: RawPanelData | undefined,
    fallbackStatus?: string,
): PanelTelemetry {
    return {
        status: raw?.status ?? fallbackStatus,
        voltage: serializeNumber(raw?.voltage),
        current: serializeNumber(raw?.current),
        power: serializeNumber(raw?.power),
        temperature: serializeNumber(raw?.temperature),
        irradiance: serializeNumber(raw?.irradiance),
        expected_power: serializeNumber(raw?.expected_power),
        performance_ratio: serializeNumber(
            raw?.performance_ratio,
        ),
        environmental_state: raw?.environmental_state,
        diagnostic_basis: raw?.diagnostic_basis,
    };
}

type PositionedPanel = PanelInfo & {
    centerX: number;
    centerY: number;
};

type StringColumn = {
    x: number;
    centerX: number;
    panels: PositionedPanel[];
};

export default function PanelMapOverlay({
    selectedMac,
    onPanelClick,
    onSelectionMeta,
}: Props) {
    const [layout, setLayout] = useState<PanelInfo[]>([]);
    const [statuses, setStatuses] = useState<
        Record<string, string>
    >({});
    const [rawByMac, setRawByMac] = useState<
        Record<string, RawPanelData | undefined>
    >({});

    const layoutHashRef = useRef("");
    const statusHashRef = useRef("");

    useEffect(() => {
        let mounted = true;

        const fetchLayoutOnce = async () => {
            try {
                const data = await getLayout();
                const nextHash = JSON.stringify(data);

                if (
                    mounted &&
                    nextHash !== layoutHashRef.current
                ) {
                    layoutHashRef.current = nextHash;
                    setLayout((data as PanelInfo[]) ?? []);
                }
            } catch {
                // Retain the last valid layout when a poll fails.
            }
        };

        void fetchLayoutOnce();

        const interval = window.setInterval(
            fetchLayoutOnce,
            5000,
        );

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
                            const response =
                                await getPanelStatus(panel.mac);

                            const raw: RawPanelData = {
                                status:
                                    response?.status !== undefined
                                        ? String(
                                              response.status,
                                          ).toLowerCase()
                                        : undefined,
                                voltage: toFiniteNumber(
                                    response?.voltage,
                                ),
                                current: toFiniteNumber(
                                    response?.current,
                                ),
                                power: toFiniteNumber(
                                    response?.power,
                                ),
                                temperature: toFiniteNumber(
                                    response?.temperature,
                                ),
                                irradiance: toFiniteNumber(
                                    response?.irradiance,
                                ),
                                expected_power: toFiniteNumber(
                                    response?.expected_power,
                                ),
                                performance_ratio:
                                    toFiniteNumber(
                                        response?.performance_ratio,
                                    ),
                                environmental_state:
                                    response?.environmental_state !==
                                    undefined
                                        ? String(
                                              response.environmental_state,
                                          )
                                        : undefined,
                                diagnostic_basis:
                                    response?.diagnostic_basis !==
                                    undefined
                                        ? String(
                                              response.diagnostic_basis,
                                          )
                                        : undefined,
                            };

                            return [
                                panel.mac,
                                {
                                    status:
                                        raw.status ?? "unknown",
                                    raw,
                                },
                            ] as const;
                        } catch {
                            return [
                                panel.mac,
                                {
                                    status: "unknown",
                                    raw: undefined,
                                },
                            ] as const;
                        }
                    }),
                );

                if (!mounted) return;

                const nextStatuses: Record<string, string> =
                    Object.fromEntries(
                        results.map(([mac, payload]) => [
                            mac,
                            payload.status,
                        ]),
                    );

                const nextRaw: Record<
                    string,
                    RawPanelData | undefined
                > = Object.fromEntries(
                    results.map(([mac, payload]) => [
                        mac,
                        payload.raw,
                    ]),
                );

                const nextStatusHash =
                    JSON.stringify(nextStatuses);

                if (
                    nextStatusHash !== statusHashRef.current
                ) {
                    statusHashRef.current = nextStatusHash;
                    setStatuses(nextStatuses);
                }

                setRawByMac(nextRaw);
            } catch {
                // Retain the last valid telemetry when a poll fails.
            }
        };

        void fetchStatuses();

        const interval = window.setInterval(
            fetchStatuses,
            5000,
        );

        return () => {
            mounted = false;
            window.clearInterval(interval);
        };
    }, [layout]);

    useEffect(() => {
        if (!selectedMac) return;

        onSelectionMeta?.(
            selectedMac,
            toTelemetry(
                rawByMac[selectedMac],
                statuses[selectedMac] ?? "unknown",
            ),
        );
    }, [
        selectedMac,
        statuses,
        rawByMac,
        onSelectionMeta,
    ]);

    const geometry = useMemo(() => {
        const cellWidth = 58;
        const cellHeight = 24;
        const panelWidth = 50;
        const panelHeight = 13;
        const topPadding = 9;
        const sidePadding = 8;
        const cableGap = 3;
        const busDrop = 19;
        const inverterGap = 10;
        const inverterWidth = 50;
        const inverterHeight = 32;

        const maxX = layout.length
            ? Math.max(...layout.map((panel) => panel.x))
            : 1;
        const maxY = layout.length
            ? Math.max(...layout.map((panel) => panel.y))
            : 1;

        const positioned: PositionedPanel[] = layout.map(
            (panel) => ({
                ...panel,
                centerX:
                    sidePadding +
                    (panel.x - 1) * cellWidth +
                    cellWidth / 2,
                centerY:
                    topPadding +
                    (panel.y - 1) * cellHeight +
                    cellHeight / 2,
            }),
        );

        const grouped = new Map<number, PositionedPanel[]>();

        for (const panel of positioned) {
            const existing = grouped.get(panel.x) ?? [];
            existing.push(panel);
            grouped.set(panel.x, existing);
        }

        const strings: StringColumn[] = Array.from(
            grouped.entries(),
        )
            .sort(([xA], [xB]) => xA - xB)
            .map(([x, panels]) => {
                const sortedPanels = [...panels].sort(
                    (a, b) => a.y - b.y,
                );

                return {
                    x,
                    centerX:
                        sortedPanels[0]?.centerX ??
                        sidePadding + cellWidth / 2,
                    panels: sortedPanels,
                };
            });

        const boardWidth =
            sidePadding * 2 + Math.max(maxX, 1) * cellWidth;

        const panelFieldBottom =
            topPadding +
            Math.max(maxY, 1) * cellHeight +
            panelHeight / 2;

        const busY = panelFieldBottom + busDrop;
        const inverterTop = busY + inverterGap;
        const inverterCenterX = boardWidth / 2;
        const inverterCenterY =
            inverterTop + inverterHeight / 2;

        const svgHeight =
            inverterTop + inverterHeight + 9;

        return {
            cellWidth,
            cellHeight,
            panelWidth,
            panelHeight,
            cableGap,
            boardWidth,
            svgHeight,
            busY,
            inverterTop,
            inverterWidth,
            inverterHeight,
            inverterCenterX,
            inverterCenterY,
            positioned,
            strings,
        };
    }, [layout]);

    const panelByMac = useMemo(
        () =>
            new Map(
                geometry.positioned.map((panel) => [
                    panel.mac,
                    panel,
                ]),
            ),
        [geometry.positioned],
    );

    return (
        <div
            className="panel-section"
            style={{
                width: "100%",
                minWidth: 0,
            }}
        >
            <svg
                width="100%"
                viewBox={`0 0 ${geometry.boardWidth} ${geometry.svgHeight}`}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-auto"
                role="img"
                aria-label="Solar panel strings connected to an inverter"
            >
                <defs>
                    <filter
                        id="panel-shadow"
                        x="-30%"
                        y="-50%"
                        width="160%"
                        height="200%"
                    >
                        <feDropShadow
                            dx="0"
                            dy="1.2"
                            stdDeviation="1.2"
                            floodColor="#000"
                            floodOpacity="0.35"
                        />
                    </filter>

                    <linearGradient
                        id="inverter-face"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor="#2b2b2b"
                        />
                        <stop
                            offset="100%"
                            stopColor="#090909"
                        />
                    </linearGradient>
                </defs>

                {/*
                  Draw all wiring first so the panel nodes sit cleanly on top.
                */}
                <g
                    aria-hidden="true"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    {geometry.strings.map((string) => {
                        if (string.panels.length === 0) {
                            return null;
                        }

                        const first = string.panels[0];
                        const last =
                            string.panels[
                                string.panels.length - 1
                            ];

                        const topY =
                            first.centerY +
                            geometry.panelHeight / 2 +
                            geometry.cableGap;
                        const bottomY =
                            last.centerY +
                            geometry.panelHeight / 2 +
                            geometry.cableGap;

                        return (
                            <g key={`string-${string.x}`}>
                                {string.panels
                                    .slice(0, -1)
                                    .map((panel, index) => {
                                        const next =
                                            string.panels[
                                                index + 1
                                            ];

                                        const y1 =
                                            panel.centerY +
                                            geometry.panelHeight /
                                                2 +
                                            geometry.cableGap;
                                        const y2 =
                                            next.centerY -
                                            geometry.panelHeight /
                                                2 -
                                            geometry.cableGap;

                                        return (
                                            <g
                                                key={`${panel.mac}-${next.mac}`}
                                            >
                                                <path
                                                    d={`M ${string.centerX} ${y1} L ${string.centerX} ${y2}`}
                                                    stroke={
                                                        CABLE_HIGHLIGHT
                                                    }
                                                    strokeWidth="4.8"
                                                />
                                                <path
                                                    d={`M ${string.centerX} ${y1} L ${string.centerX} ${y2}`}
                                                    stroke={
                                                        CABLE_COLOR
                                                    }
                                                    strokeWidth="3.2"
                                                />
                                            </g>
                                        );
                                    })}

                                <path
                                    d={[
                                        `M ${string.centerX} ${bottomY}`,
                                        `L ${string.centerX} ${
                                            geometry.busY - 8
                                        }`,
                                        `Q ${string.centerX} ${
                                            geometry.busY
                                        } ${
                                            string.centerX +
                                            Math.sign(
                                                geometry.inverterCenterX -
                                                    string.centerX,
                                            ) *
                                                8
                                        } ${geometry.busY}`,
                                        `L ${
                                            geometry.inverterCenterX
                                        } ${geometry.busY}`,
                                    ].join(" ")}
                                    stroke={CABLE_HIGHLIGHT}
                                    strokeWidth="5.4"
                                />
                                <path
                                    d={[
                                        `M ${string.centerX} ${bottomY}`,
                                        `L ${string.centerX} ${
                                            geometry.busY - 8
                                        }`,
                                        `Q ${string.centerX} ${
                                            geometry.busY
                                        } ${
                                            string.centerX +
                                            Math.sign(
                                                geometry.inverterCenterX -
                                                    string.centerX,
                                            ) *
                                                8
                                        } ${geometry.busY}`,
                                        `L ${
                                            geometry.inverterCenterX
                                        } ${geometry.busY}`,
                                    ].join(" ")}
                                    stroke={CABLE_COLOR}
                                    strokeWidth="3.5"
                                />

                                <circle
                                    cx={string.centerX}
                                    cy={topY}
                                    r="2.1"
                                    fill={CABLE_COLOR}
                                    stroke="none"
                                />
                            </g>
                        );
                    })}

                    <path
                        d={`M ${geometry.inverterCenterX} ${geometry.busY} L ${geometry.inverterCenterX} ${geometry.inverterTop}`}
                        stroke={CABLE_HIGHLIGHT}
                        strokeWidth="6"
                    />
                    <path
                        d={`M ${geometry.inverterCenterX} ${geometry.busY} L ${geometry.inverterCenterX} ${geometry.inverterTop}`}
                        stroke={CABLE_COLOR}
                        strokeWidth="4"
                    />

                    <circle
                        cx={geometry.inverterCenterX}
                        cy={geometry.busY}
                        r="4.2"
                        fill="#171717"
                        stroke="#4b5563"
                        strokeWidth="1"
                    />
                </g>

                {geometry.positioned.map((panel) => {
                    const status =
                        statuses[panel.mac] ?? "unknown";
                    const color =
                        statusColorMap[status] ??
                        statusColorMap.unknown;
                    const isSelected =
                        selectedMac === panel.mac;

                    return (
                        <g
                            key={panel.mac}
                            onClick={() => {
                                onPanelClick(panel.mac);
                                onSelectionMeta?.(
                                    panel.mac,
                                    toTelemetry(
                                        rawByMac[panel.mac],
                                        status,
                                    ),
                                );
                            }}
                            className="panel cursor-pointer"
                            role="button"
                            tabIndex={0}
                            aria-label={`Select panel ${panel.mac}`}
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                ) {
                                    event.preventDefault();
                                    onPanelClick(panel.mac);
                                    onSelectionMeta?.(
                                        panel.mac,
                                        toTelemetry(
                                            rawByMac[panel.mac],
                                            status,
                                        ),
                                    );
                                }
                            }}
                            filter="url(#panel-shadow)"
                        >
                            <rect
                                x={
                                    panel.centerX -
                                    geometry.panelWidth / 2
                                }
                                y={
                                    panel.centerY -
                                    geometry.panelHeight / 2
                                }
                                width={geometry.panelWidth}
                                height={geometry.panelHeight}
                                rx={6}
                                fill={color}
                                stroke={
                                    isSelected
                                        ? "#000"
                                        : "rgba(0,0,0,0.45)"
                                }
                                strokeWidth={
                                    isSelected ? 2.2 : 0.8
                                }
                            />

                            <text
                                x={panel.centerX}
                                y={panel.centerY}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                className="panel-label select-none"
                                fill={
                                    status === "open_circuit" ||
                                    status === "gross_power_drop"
                                        ? "#fff"
                                        : "#000"
                                }
                            >
                                {panel.mac}
                            </text>
                        </g>
                    );
                })}

                <g
                    aria-label="Inverter"
                    transform={`translate(${
                        geometry.inverterCenterX -
                        geometry.inverterWidth / 2
                    } ${geometry.inverterTop})`}
                    filter="url(#panel-shadow)"
                >
                    <rect
                        x="0"
                        y="0"
                        width={geometry.inverterWidth}
                        height={geometry.inverterHeight}
                        rx="5"
                        fill="url(#inverter-face)"
                        stroke="#050505"
                        strokeWidth="1"
                    />

                    <rect
                        x="8"
                        y="6"
                        width={
                            geometry.inverterWidth - 16
                        }
                        height="15"
                        rx="2.3"
                        fill="#202020"
                        stroke="#474747"
                        strokeWidth="0.8"
                    />

                    <path
                        d={`M 15 13
                            C 19 6, 22 6, 25 13
                            S 32 20, 35 13`}
                        fill="none"
                        stroke="#f8fafc"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />

                    <text
                        x={geometry.inverterWidth / 2}
                        y="25"
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize="5.3"
                        fontWeight="800"
                        letterSpacing="0.4"
                    >
                        INVERTER
                    </text>

                    <circle
                        cx={
                            geometry.inverterWidth / 2 -
                            7
                        }
                        cy="28.5"
                        r="1.35"
                        fill="#22c55e"
                    />
                    <circle
                        cx={geometry.inverterWidth / 2}
                        cy="28.5"
                        r="1.35"
                        fill="#a3a3a3"
                    />
                    <circle
                        cx={
                            geometry.inverterWidth / 2 +
                            7
                        }
                        cy="28.5"
                        r="1.35"
                        fill="#a3a3a3"
                    />
                </g>
            </svg>
        </div>
    );
}
