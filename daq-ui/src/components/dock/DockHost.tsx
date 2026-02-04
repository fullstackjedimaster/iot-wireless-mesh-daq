// daq-ui/src/components/dock/DockHost.tsx
"use client";

import { useEffect, useRef } from "react";
import { useSelectedTarget } from "@/contexts/SelectedPanelContext";
import { toTargetSelectedMsg } from "@/lib/dock/selection";

function assert(condition: unknown, msg: string): asserts condition {
    if (!condition) throw new Error(`[daq-ui DockHost] ${msg}`);
}

function requireEnv(name: string): string {
    const v = process.env[name] as string | undefined;
    assert(typeof v === "string" && v.length > 0, `${name} is required and must be set.`);
    return v;
}

export default function DockHost() {
    const { subscribeSelectedTarget } = useSelectedTarget();
    const lastSentRef = useRef<string>("");

    useEffect(() => {
        const FRAME_ID = requireEnv("NEXT_PUBLIC_DOCK_FRAME_ID");
        const DOCK_ORIGIN = requireEnv("NEXT_PUBLIC_DOCK_ORIGIN");

        const iframe = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;
        assert(iframe, `Dock iframe not found: id="${FRAME_ID}"`);

        const target = iframe.contentWindow;
        assert(target, "Dock iframe has no contentWindow.");

        return subscribeSelectedTarget((t) => {
            assert(t, "SelectedTarget is null.");

            const msg = toTargetSelectedMsg(t);
            const serialized = JSON.stringify(msg);
            if (serialized === lastSentRef.current) return; // dedupe only
            lastSentRef.current = serialized;

            target.postMessage(msg, DOCK_ORIGIN);
        });
    }, [subscribeSelectedTarget]);

    return null;
}
