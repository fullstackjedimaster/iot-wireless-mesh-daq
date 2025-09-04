"use client"

import { useEffect, useRef } from "react"
import { Line } from "react-chartjs-2"
import {
    Chart as ChartJS,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Legend,
    Tooltip,
    Filler,
    TimeScale
} from "chart.js"
import { getPanelStatus } from "@/lib/api"
import "chartjs-adapter-date-fns"

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Legend, Tooltip, Filler, TimeScale)

interface ChartPanelProps {
    selectedMac: string
}

const MAX_POINTS = 30

export default function ChartPanel({ selectedMac }: ChartPanelProps) {
    const chartRef = useRef<ChartJS<"line">>(null)

    // Reset chart on panel change
    useEffect(() => {
        const chart = chartRef.current
        if (!chart) return

        if (chart.data.labels) chart.data.labels.length = 0
        chart.data.datasets.forEach(dataset => {
            dataset.data = []
        })

        chart.update()
    }, [selectedMac])

    // Poll and update chart
    useEffect(() => {
        if (!selectedMac) return

        const interval = setInterval(async () => {
            try {
                const data = await getPanelStatus(selectedMac)
                const v = parseFloat(data.voltage ?? "0")
                const c = parseFloat(data.current ?? "0")
                const now = Date.now()

                const chart = chartRef.current
                if (!chart) return

                const labels = chart.data.labels
                const vDataset = chart.data.datasets[0]
                const cDataset = chart.data.datasets[1]

                if (!Array.isArray(labels)) return

                labels.push(now)
                vDataset.data.push(v)
                cDataset.data.push(c)

                if (labels.length > MAX_POINTS) {
                    labels.shift()
                    vDataset.data.shift()
                    cDataset.data.shift()
                }

                chart.update()
            } catch (error) {
                console.error("Failed to fetch panel stats:", error)
            }
        }, 2000)

        return () => clearInterval(interval)
    }, [selectedMac])

    const chartData = {
        labels: [],
        datasets: [
            {
                label: "Voltage (V)",
                data: [],
                borderColor: "green",
                backgroundColor: "rgba(34,197,94,0.2)",
                fill: true,
                tension: 0.3
            },
            {
                label: "Current (A)",
                data: [],
                borderColor: "blue",
                backgroundColor: "rgba(59,130,246,0.2)",
                fill: true,
                tension: 0.3
            }
        ]
    }

    return (
        <div
            className="panel-section"
            style={{
                width: "100%",
                maxWidth: "338px", // Matches wrapped card
                margin: "0 auto",
                padding: "0.5rem",
                boxSizing: "border-box",
                overflowX: "hidden"
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "200px",
                    overflow: "hidden"
                }}
            >
                <Line
                    ref={chartRef}
                    data={chartData}
                    style={{ maxWidth: "100%" }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 300,
                            easing: "easeOutQuart"
                        },
                        scales: {
                            x: {
                                type: "time",
                                time: {
                                    unit: "second",
                                    tooltipFormat: "HH:mm:ss",
                                    displayFormats: {
                                        second: "HH:mm:ss"
                                    }
                                },
                                ticks: {
                                    autoSkip: true,
                                    maxTicksLimit: 10
                                }
                            },
                            y: {
                                beginAtZero: true
                            }
                        }
                    }}
                />
            </div>
        </div>
    )


}
