//daq-ui/src/lib/api.ts

interface Panel {
    mac: string
    x: number
    y: number
    height: number
    width: number
}

interface PanelStatusResponse {
    mac: string
    status: string
    voltage: string | undefined
    current: string | undefined
    power: string | undefined
    temperature: string | undefined
}

export type FaultProfile = Record<string, number>

const API_BASE =  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";


export async function getLayout(): Promise<Panel[]> {

    const res = await fetch(`${API_BASE}/api/layout`)

    if (!res.ok) {
        console.error("Failed to fetch layout:", res.status)
        throw new Error("Layout fetch failed")
    }

    const data = await res.json()

    if (Array.isArray(data)) {
        return data
    } else {
        console.warn("Layout response was not an array:", data)
        return []
    }
}

export async function getPanelStatus(mac: string): Promise<PanelStatusResponse> {

    const res = await fetch(`${API_BASE}/api/status/${encodeURIComponent(mac)}`)
    if (!res.ok) {
        console.error(`Failed to fetch status for ${mac}:`, res.status)
        throw new Error("Panel status fetch failed")
    }

        return res.json()
    // return  {mac:mac, status: 'normal', voltage: '5.0', current: '7.0', power: '10.0', temperature: '10.0'}
}

export async function injectFault(mac: string, fault: string): Promise<void> {

    const res = await fetch(`${API_BASE}/api/inject_fault`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, fault })
    })

    if (!res.ok) {
        throw new Error(`Failed to inject fault: ${await res.text()}`)
    }
}

export async function clearAllFaults(): Promise<void> {

    const res = await fetch(`${API_BASE}/api/clear_all_faults`, {
        method: "POST"
    })

    if (!res.ok) {
        throw new Error(`Failed to clear faults: ${await res.text()}`)
    }
}


export async function getProfile(): Promise<Record<string, FaultProfile>> {
    const res = await fetch("${API_BASE}/api/faults/profile")
    return res.json()
}

export function getStatusLabel(profile: FaultProfile): string {
    const criticalFaults = Object.entries(profile).filter(
        ([k, v]) =>
            ["OPEN_CIRCUIT", "SNAPPED_DIODE", "DEAD_PANEL"].includes(k) && v > 0
    )
    if (criticalFaults.length) return "faulted"

    const warnings = Object.entries(profile).filter(
        ([k, v]) =>
            ["POWER_DROP", "LOW_VOLTAGE", "LOW_POWER"].includes(k) && v > 0
    )
    if (warnings.length) return "degraded"

    return "normal"
}
