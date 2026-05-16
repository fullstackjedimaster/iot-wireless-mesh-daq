"use client";

import { useEffect } from "react";

export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue>;

export type SelectedTarget = {
    id: string;
    attrs?: Attrs | null;
    source?: string;
};

export type TargetSelectedMsg = {
    type: "TARGET_SELECTED";
    id: string;
    subject_id: string;
    attrs: Attrs;
    source: string;
};

export function assertNonEmptyString(v: unknown, msg: string): asserts v is string {
    if (typeof v !== "string" || v.trim().length === 0) {
        throw new Error(msg);
    }
}

function normalizeAttrs(attrs?: Attrs | null): Attrs {
    const out: Attrs = { ...(attrs ?? {}) };

    const voltage = Number(out.voltage);
    const current = Number(out.current);

    if (
        out.power === undefined &&
        Number.isFinite(voltage) &&
        Number.isFinite(current)
    ) {
        out.power = Number((voltage * current).toFixed(3));
    }

    return out;
}

export function toTargetSelectedMsg(t: SelectedTarget): TargetSelectedMsg {
    assertNonEmptyString(t?.id, "[selection] SelectedTarget.id must be non-empty");

    return {
        type: "TARGET_SELECTED",
        id: t.id,
        subject_id: t.id,
        attrs: normalizeAttrs(t.attrs),
        source: t.source ?? "daq-ui",
    };
}

export function useBroadcastSelectedTarget(
    id: string,
    attrs?: Attrs | null,
    source = "daq-ui"
) {
    useEffect(() => {
        if (!id) return;

        window.postMessage(
            toTargetSelectedMsg({
                id,
                attrs,
                source,
            }),
            "*"
        );
    }, [id, attrs, source]);
}