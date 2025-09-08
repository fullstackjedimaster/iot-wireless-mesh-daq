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

    // Keep data in React state; pass to <Line />
    const [volts, setVolts] = useState<XY[]>([]);
    const [amps, setAmps] = useState<XY[]>([]);

    // Reset on MAC change
    useEffect(() => {
        setVolts([]);
        setAmps([]);
        const chart = chartRef.current;
        if (chart) chart.update();
    }, [selectedMac]);

    // Poll and append points
    useEffect(() => {
        if (!selectedMac) return;

        const interval = setInterval(async () => {
            try {
                const data = await getPanelStatus(selectedMac);

                const vRaw = data?.voltage;
                const cRaw = data?.current;

                const v = Number(vRaw);
                const c = Number(cRaw);

                // Only append if they are finite numbers
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
                // Silently ignore; keeps UI calm if a tick fails
                // console.error("poll error", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [selectedMac]);

    const chartData: ChartData<"line"> = useMemo(() => {
        const vDataset: ChartDataset<"line", XY[]> = {
            label: "Voltage (V)",
            data: volts,
            parsing: false, // because we're providing {x,y}
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
            <div style={{ position: "relative", width: "100%", height: 200, overflow: "hidden" }}>
                <Line
                    ref={chartRef}
                    data={chartData}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 250, easing: "easeOutQuart" },
                        parsing: false,
                        scales: {
                            x: {
                                type: "time",
                                time: {
                                    unit: "second",
                                    tooltipFormat: "HH:mm:ss",
                                    displayFormats: { second: "HH:mm:ss" },
                                },
                                ticks: { autoSkip: true, maxTicksLimit: 10 },
                            },
                            y: { beginAtZero: true },
                        },
                        plugins: {
                            legend: { display: true },
                            tooltip: { mode: "nearest", intersect: false },
                        },
                    }}
                />
            </div>
        </div>
    );
}
