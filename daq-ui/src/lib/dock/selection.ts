"use client";

import { useEffect } from "react";

import type { Attrs, TargetSelectedMessage } from "@/lib/dock/messages";

export type SelectedTarget = {
    id: string;
    attrs: Attrs;
    source: string;
};

function withComputedPower(attrs: Attrs): Attrs {
    const next = { ...attrs };
    const voltage = Number(next.voltage);
    const current = Number(next.current);

    if (
        next.power === undefined &&
        Number.isFinite(voltage) &&
        Number.isFinite(current)
    ) {
        next.power = Number((voltage * current).toFixed(3));
    }

    return next;
}

export function createTargetSelectedMessage(
    target: SelectedTarget,
): TargetSelectedMessage {
    return {
        type: "TARGET_SELECTED",
        id: target.id,
        attrs: withComputedPower(target.attrs),
        source: target.source,
    };
}

export function broadcastSelectedTarget(target: SelectedTarget): void {
    window.postMessage(createTargetSelectedMessage(target), window.location.origin);
}

export function useBroadcastSelectedTarget(target: SelectedTarget): void {
    useEffect(() => {
        broadcastSelectedTarget(target);
    }, [target]);
}
