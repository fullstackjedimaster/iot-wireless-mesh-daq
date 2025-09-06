// ui-daq/src/lib/aiBridge.ts
// Sends selection + telemetry upward to the embedding parent (portfolio)
// Types are explicit to satisfy eslint rules.

export type PanelTelemetry = {
    voltage?: string;
    current?: string;
    status?: string;
};

export type PanelSelectedMessage = {
    type: "PANEL_SELECTED";
    mac: string;
    telemetry?: PanelTelemetry;
    source: "daq-ui";
    frameId?: string;
};

export function notifyPanelSelected(mac: string, telemetry?: PanelTelemetry, frameId?: string) {
    const msg: PanelSelectedMessage = {
        type: "PANEL_SELECTED",
        mac,
        telemetry,
        source: "daq-ui",
        frameId,
    };
    // If embedded, parent is the portfolio. If not, this is a no-op.
    try {
        window.parent?.postMessage(msg, "*");
    } catch {
        /* ignore */
    }
}
