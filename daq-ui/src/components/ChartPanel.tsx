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
    ChartDataset,
    ChartData,
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
    TimeScale
);

interface ChartPanelProps {
    selectedMac: string;
}

type XY = { x: number; y: number };

const MAX_POINTS = 30;

export default function ChartPanel({ selectedMac }: ChartPanelProps) {
    const chartRef = useRef<ChartJS<"line">>(null);

    // Live series state
    const [volts, setVolts] = useState<XY[]>([]);
    const [amps, setAmps] = useState<XY[]>([]);

    // Reset when MAC changes
    useEffect(() => {
        setVolts([]);
        setAmps([]);
        const chart = chartRef.current;
        if (chart) chart.update();
    }, [selectedMac]);

    // Poll every 2s and append points
    useEffect(() => {
        if (!selectedMac) return;

        const interval = setInterval(async () => {
            try {
                const data = await getPanelStatus(selectedMac);

                const v = Number(data?.voltage);
                const c = Number(data?.current);

                const now = Date.now();
                setVolts((prev) => {
                    const next = [...prev, { x: now, y: Number.isFinite(v) ? v : 0 }];
                    return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
                });
                setAmps((prev) => {
                    const next = [...prev, { x: now, y: Number.isFinite(c) ? c : 0 }];
                    return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
                });
            } catch (err) {
                // Keep UI calm if a tick fails
                console.error("poll error", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [selectedMac]);

    const chartData: ChartData<"line"> = useMemo(() => {
        const vDataset: ChartDataset<"line", XY[]> = {
            label: "Voltage (V)",
            data: volts,
            parsing: false, // we provide {x,y}
            borderColor: "green",
            backgroundColor: "rgba(34,197,94,0.2)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
        };
        const cDataset: ChartDataset<"line", XY[]> = {
            label: "Current (A)",
            data: amps,
            parsing: false,
            borderColor: "blue",
            backgroundColor: "rgba(59,130,246,0.2)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
        };
        return { datasets: [vDataset, cDataset] };
    }, [volts, amps]);

    return (
        <div
            className="panel-section"
            style={{
                width: "100%",
                maxWidth: "338px",
                margin: "0 auto",
                padding: "0.5rem",
                boxSizing: "border-box",
                overflowX: "hidden",
            }}
        >
            {/* Fixed-height container prevents iframe feedback loops */}
            <div style={{ position: "relative", width: "100%", height: 260, overflow: "hidden" }}>
                <Line
                    ref={chartRef}
                    data={chartData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false, // fill the 260px box
                        animation: false,           // avoid tiny reflow jitter
                        parsing: false,
                        layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
                        scales: {
                            x: {
                                type: "time",
                                time: {
                                    unit: "second",
                                    tooltipFormat: "HH:mm:ss",
                                    displayFormats: { second: "HH:mm:ss" },
                                },
                                ticks: {
                                    autoSkip: true,
                                    maxTicksLimit: 8,
                                },
                                grid: { display: true },
                            },
                            y: {
                                beginAtZero: true,
                                ticks: { maxTicksLimit: 6 },
                                grid: { display: true },
                            },
                        },
                        plugins: {
                            legend: {
                                display: true,       // ✅ keep legend
                                position: "bottom",
                                labels: {
                                    boxWidth: 18,
                                    padding: 12,
                                },
                            },
                            tooltip: { mode: "nearest", intersect: false },
                        },
                    }}
                />
            </div>
        </div>
    );
}
