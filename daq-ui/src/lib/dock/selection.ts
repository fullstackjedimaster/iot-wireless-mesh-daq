// daq-ui/src/lib/dock/selection.ts

export type Attrs = Record<string, string | number | boolean | null | undefined>;

export type SelectedTarget = {
    id: string;
    attrs?: Attrs | null;
    source?: string;
};

export type TargetSelectedMsg = {
    type: "TARGET_SELECTED";
    id: string;
    attrs?: Attrs | null;
    source?: string;
};

export function assertNonEmptyString(v: unknown, msg: string): asserts v is string {
    if (typeof v !== "string" || v.length === 0) throw new Error(msg);
}

export function toTargetSelectedMsg(t: SelectedTarget): TargetSelectedMsg {
    assertNonEmptyString(t?.id, `[selection] SelectedTarget.id must be non-empty`);
    return {
        type: "TARGET_SELECTED",
        id: t.id,
        attrs: t.attrs ?? null,
        source: t.source,
    };
}
