"use client"

import { useEffect, useState } from "react"
import { getLayout, injectFault, clearAllFaults } from "@/lib/api"

interface PanelOption {
    mac: string
    label: string
}

const faultOptions = [
    { value: "short_circuit", label: "Short Circuit" },
    { value: "open_circuit", label: "Open Circuit" },
    { value: "low_voltage", label: "Low Voltage" },
    { value: "dead_panel", label: "Dead Panel" },
    { value: "random", label: "Random" },
    { value: "reset", label: "Reset to Normal" },
]

export default function ControlPanel() {
    const [panelOptions, setPanelOptions] = useState<PanelOption[]>([])
    const [selectedPanel, setSelectedPanel] = useState("")
    const [fault, setFault] = useState("")
    const [message, setMessage] = useState("")

    useEffect(() => {
        const fetchMacs = async () => {
            try {
                const data = await getLayout()
                const formatted = data.map((p: { mac: string }, i: number) => ({
                    mac: p.mac,
                    label: `Panel ${i + 1}`,
                }))
                setPanelOptions(formatted)
            } catch (err) {
                console.error("Failed to fetch MAC list:", err)
            }
        }
        fetchMacs()
    }, [])

    const handleInject = async () => {
        if (!selectedPanel || !fault) return
        try {
            await injectFault(selectedPanel, fault)
            setMessage("✅ Fault injected!")
        } catch {
            setMessage("⚠️ Failed to inject fault.")
        }
    }

    const handleClear = async () => {
        try {
            await clearAllFaults()
            setMessage("✅ All faults cleared.")
        } catch {
            setMessage("⚠️ Failed to clear faults.")
        }
    }

    return (
        <div className="control-section">
            <div>
                <select
                    value={selectedPanel}
                    onChange={(e) => setSelectedPanel(e.target.value)}
                >
                    <option value="">Panel...</option>
                    {panelOptions.map((opt) => (
                        <option key={opt.mac} value={opt.mac}>{opt.label}</option>
                    ))}
                </select>

                <select
                    value={fault}
                    onChange={(e) => setFault(e.target.value)}
                >
                    <option value="">Fault...</option>
                    {faultOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
            <div >
                <button
                    onClick={handleInject}
                    className=""

                >
                    Inject Fault
                </button>
                <button
                    onClick={handleClear}
                    className=""

                >
                    Clear Faults
                </button>

            </div>
             <div>
                {message && (
                    <div className="mt-2 italic  text-center text-gray-400">{message}</div>
                )}

            </div>
        </div>
    )
}
