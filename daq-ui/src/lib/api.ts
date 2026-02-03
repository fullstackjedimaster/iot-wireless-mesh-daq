// daq-ui/src/lib/api.ts
import { getEmbedToken } from "@/lib/embedTokenStore";

interface Panel {
    mac: string;
    x: number;
    y: number;
    height?: number;
    width?: number;
}

interface PanelStatusResponse {
    mac: string;
    status: string;
    voltage: string | undefined;
    current: string | undefined;
    power: string | undefined;
    temperature: string | undefined;
}

export type FaultProfile = Record<string, number>;

// NOTE: docker-compose sets NEXT_PUBLIC_CLOUD_API_BASE
// Example (recommended): https://cloud.fullstackjedi.dev
const API_BASE = process.env.NEXT_PUBLIC_CLOUD_API_BASE ?? "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMutationMethod(method: string | undefined): boolean {
    const m = (method || "GET").toUpperCase();
    return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

function joinUrl(base: string, path: string): string {
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${b}${p}`;
}

// ---------------------------------------------------------------------------
// Low-level helper: always use this so we can inject X-Embed-Token centrally.
// Also: credentials MUST be "include" so pf_embed_sid cookie is sent to cloud.
// ---------------------------------------------------------------------------
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const url = joinUrl(API_BASE, path);

    const headers = new Headers(init.headers || {});
    const method = (init.method || "GET").toUpperCase();

    // Only attach embed token for POST/PUT/PATCH/DELETE
    if (isMutationMethod(method)) {
        const token = getEmbedToken();
        if (token) headers.set("X-Embed-Token", token);
    }

    const res = await fetch(url, {
        ...init,
        method,
        headers,
        // REQUIRED for sid-binding cookie to be included on cross-subdomain calls
        credentials: init.credentials ?? "include",
    });

    return res;
}

// ---------------------------------------------------------------------------
// Public API helpers used by components
// ---------------------------------------------------------------------------

export async function getLayout(): Promise<Panel[]> {
    const res = await apiFetch("/api/layout");

    if (!res.ok) {
        console.error("Failed to fetch layout:", res.status);
        throw new Error("Layout fetch failed");
    }

    const data = await res.json();

    if (Array.isArray(data)) {
        return data as Panel[];
    }

    console.warn("Layout response was not an array:", data);
    return [];
}

export async function getPanelStatus(mac: string): Promise<PanelStatusResponse> {
    const res = await apiFetch(`/api/status/${encodeURIComponent(mac)}`);

    if (!res.ok) {
        console.error(`Failed to fetch status for ${mac}:`, res.status);
        throw new Error("Panel status fetch failed");
    }

    return res.json();
}

export async function injectFault(mac: string, fault: string): Promise<void> {
    const res = await apiFetch("/api/inject_fault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mac, fault }),
    });

    if (!res.ok) {
        throw new Error(`Failed to inject fault: ${await res.text()}`);
    }
}

export async function clearAllFaults(): Promise<void> {
    const res = await apiFetch("/api/clear_all_faults", {
        method: "POST",
    });

    if (!res.ok) {
        throw new Error(`Failed to clear faults: ${await res.text()}`);
    }
}

export async function getProfile(): Promise<Record<string, FaultProfile>> {
    const res = await apiFetch("/api/faults/profile");

    if (!res.ok) {
        throw new Error(`Failed to fetch profile: ${await res.text()}`);
    }

    return res.json();
}

export function getStatusLabel(profile: FaultProfile): string {
    const criticalFaults = Object.entries(profile).filter(
        ([k, v]) => ["OPEN_CIRCUIT", "SNAPPED_DIODE", "DEAD_PANEL"].includes(k) && v > 0
    );
    if (criticalFaults.length) return "faulted";

    const warnings = Object.entries(profile).filter(
        ([k, v]) => ["POWER_DROP", "LOW_VOLTAGE", "LOW_POWER"].includes(k) && v > 0
    );
    if (warnings.length) return "degraded";

    return "normal";
}
