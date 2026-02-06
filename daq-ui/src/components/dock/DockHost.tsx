// daq-ui/src/components/dock/DockHost.tsx
"use client";

import { useEffect, useRef } from "react";
import { useSelectedTarget } from "@/contexts/SelectedPanelContext";
import { toTargetSelectedMsg } from "@/lib/dock/selection";

function getEnv(name: string): string | undefined {
    const v = (process.env as any)?.[name];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function stripTrailingSlashes(s: string): string {
    return s.replace(/\/+$/, "");
}

export default function DockHost() {
    const { subscribeSelectedTarget } = useSelectedTarget();
    const lastSentRef = useRef<string>("");

    useEffect(() => {
        // ✅ DO NOT require these. If missing, we behave like DockHost isn't here.
        const frameId = getEnv("NEXT_PUBLIC_DOCK_FRAME_ID");
        const dockOriginRaw = getEnv("NEXT_PUBLIC_DOCK_ORIGIN");

        if (!frameId || !dockOriginRaw) {
            // Not configured => inert
            return;
        }

        const dockOrigin = stripTrailingSlashes(dockOriginRaw);

        // ✅ If the dock is NOT injected/connected yet, iframe won't exist => inert
        const el = document.getElementById(frameId);
        if (!el) return;

        // Must be an iframe
        const iframe = el as HTMLIFrameElement;
        if (!iframe.contentWindow) return;

        const targetWin = iframe.contentWindow;

        // Subscribe only when we're actually connected (iframe present)
        const unsubscribe = subscribeSelectedTarget((t) => {
            if (!t) return;

            const msg = toTargetSelectedMsg(t);
            const serialized = JSON.stringify(msg);
            if (serialized === lastSentRef.current) return; // dedupe
            lastSentRef.current = serialized;

            try {
                targetWin.postMessage(msg, dockOrigin);
            } catch {
                // Never break host app because postMessage failed
            }
        });

        return () => {
            try {
                unsubscribe?.();
            } catch {
                // ignore
            }
        };
    }, [subscribeSelectedTarget]);

    return null;
}
