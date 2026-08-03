"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Legend,
    Tooltip,
    Filler,
    TimeScale,
    type ChartDataset,
    type ChartData,
} from "chart.js";
import { getPanelStatus } from "@/lib/api";
import "chartjs-adapter-date-fns";

ChartJS.register(
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Legend,
    Tooltip,
    Filler,
    TimeScale,
);

interface ChartPanelProps {
    selectedMac: string;
}

type XY = { x: number; y: number };

type SeriesState = {
    voltage: XY[];
    current: XY[];
    power: XY[];
    temperature: XY[];
    irradiance: XY[];
};

const MAX_POINTS = 30;
const EMPTY_SERIES: SeriesState = {
    voltage: [],
    current: [],
    power: [],
    temperature: [],
    irradiance: [],
};

function appendPoint(points: XY[], point: XY): XY[] {
    const next = [...points, point];
    return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
}

function numeric(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

const sharedTimeScale = {
    type: "time" as const,
    time: {
        unit: "second" as const,
        tooltipFormat: "HH:mm:ss",
        displayFormats: { second: "HH:mm:ss" },
    },
    ticks: { autoSkip: true, maxTicksLimit: 8 },
    grid: { display: true },
};

export default function ChartPanel({ selectedMac }: ChartPanelProps) {
    const electricalChartRef = useRef<ChartJS<"line">>(null);
    const environmentChartRef = useRef<ChartJS<"line">>(null);
    const [series, setSeries] = useState<SeriesState>(EMPTY_SERIES);

    useEffect(() => {
        setSeries(EMPTY_SERIES);
        electricalChartRef.current?.update();
        environmentChartRef.current?.update();
    }, [selectedMac]);

    useEffect(() => {
        if (!selectedMac) return;

        let active = true;

        const poll = async () => {
            try {
                const data = await getPanelStatus(selectedMac);
                if (!active) return;

                const now = Date.now();
                setSeries((previous) => ({
                    voltage: appendPoint(previous.voltage, { x: now, y: numeric(data?.voltage) }),
                    current: appendPoint(previous.current, { x: now, y: numeric(data?.current) }),
                    power: appendPoint(previous.power, { x: now, y: numeric(data?.power) }),
                    temperature: appendPoint(previous.temperature, { x: now, y: numeric(data?.temperature) }),
                    irradiance: appendPoint(previous.irradiance, { x: now, y: numeric(data?.irradiance) }),
                }));
            } catch (error) {
                console.error("poll error", error);
            }
        };

        void poll();
        const interval = window.setInterval(poll, 2000);

        return () => {
            active = false;
            window.clearInterval(interval);
        };
    }, [selectedMac]);

    const electricalData: ChartData<"line"> = useMemo(() => {
        const voltage: ChartDataset<"line", XY[]> = {
            label: "Voltage (V)",
            data: series.voltage,
            parsing: false,
            borderColor: "green",
            backgroundColor: "rgba(34,197,94,0.18)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: "electrical",
        };
        const current: ChartDataset<"line", XY[]> = {
            label: "Current (A)",
            data: series.current,
            parsing: false,
            borderColor: "blue",
            backgroundColor: "rgba(59,130,246,0.16)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: "electrical",
        };
        const power: ChartDataset<"line", XY[]> = {
            label: "Power (W)",
            data: series.power,
            parsing: false,
            borderColor: "orange",
            backgroundColor: "rgba(245,158,11,0.12)",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderDash: [5, 3],
            yAxisID: "power",
        };
        return { datasets: [voltage, current, power] };
    }, [series.voltage, series.current, series.power]);

    const environmentData: ChartData<"line"> = useMemo(() => {
        const temperature: ChartDataset<"line", XY[]> = {
            label: "Panel Temp (°C)",
            data: series.temperature,
            parsing: false,
            borderColor: "crimson",
            backgroundColor: "rgba(220,38,38,0.12)",
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: "temperature",
        };
        const irradiance: ChartDataset<"line", XY[]> = {
            label: "Irradiance (W/m²)",
            data: series.irradiance,
            parsing: false,
            borderColor: "goldenrod",
            backgroundColor: "rgba(234,179,8,0.14)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            yAxisID: "irradiance",
        };
        return { datasets: [temperature, irradiance] };
    }, [series.temperature, series.irradiance]);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false as const,
        parsing: false as const,
        interaction: { mode: "nearest" as const, intersect: false },
        layout: { padding: { top: 4, right: 4, bottom: 4, left: 4 } },
        plugins: {
            legend: {
                display: true,
                position: "bottom" as const,
                labels: { boxWidth: 12, padding: 8 },
            },
            tooltip: { mode: "nearest" as const, intersect: false },
        },
    };

    return (
        <div
            className="panel-section"
            style={{
                width: "100%",
                maxWidth: "390px",
                margin: "0 auto",
                padding: "0.5rem",
                boxSizing: "border-box",
                overflowX: "hidden",
            }}
        >
            <div style={{ position: "relative", width: "100%", height: 185, overflow: "hidden" }}>
                <Line
                    ref={electricalChartRef}
                    data={electricalData}
                    options={{
                        ...commonOptions,
                        scales: {
                            x: sharedTimeScale,
                            electrical: {
                                type: "linear",
                                position: "left",
                                beginAtZero: true,
                                ticks: { maxTicksLimit: 6 },
                                grid: { display: true },
                                title: { display: true, text: "V / A" },
                            },
                            power: {
                                type: "linear",
                                position: "right",
                                beginAtZero: true,
                                ticks: { maxTicksLimit: 6 },
                                grid: { drawOnChartArea: false },
                                title: { display: true, text: "W" },
                            },
                        },
                    }}
                />
            </div>

            <div style={{ position: "relative", width: "100%", height: 185, overflow: "hidden", marginTop: 8 }}>
                <Line
                    ref={environmentChartRef}
                    data={environmentData}
                    options={{
                        ...commonOptions,
                        scales: {
                            x: sharedTimeScale,
                            temperature: {
                                type: "linear",
                                position: "left",
                                ticks: { maxTicksLimit: 6 },
                                grid: { display: true },
                                title: { display: true, text: "°C" },
                            },
                            irradiance: {
                                type: "linear",
                                position: "right",
                                beginAtZero: true,
                                suggestedMax: 1200,
                                ticks: { maxTicksLimit: 6 },
                                grid: { drawOnChartArea: false },
                                title: { display: true, text: "W/m²" },
                            },
                        },
                    }}
                />
            </div>
        </div>
    );
}
