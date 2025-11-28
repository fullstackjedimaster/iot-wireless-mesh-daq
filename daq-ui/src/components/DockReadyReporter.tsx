// daq-ui/src/components/DockReadyReporter.tsx
"use client";

import { useEffect } from "react";

type DockReadyMessage = {
    type: "DAQ_DOCK_READY";
    frameId?: string;
};

export default function DockReadyReporter() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const frameId = params.get("frameId") || undefined;

        const msg: DockReadyMessage = { type: "DAQ_DOCK_READY" };
        if (frameId) {
            msg.frameId = frameId;
        }

        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage(msg, "*");
            } catch {
                // ignore
            }
        }
    }, []);

    return null;
}
