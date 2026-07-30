export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue>;

export type TargetSelectedMessage = {
    type: "TARGET_SELECTED";
    id: string;
    attrs: Attrs;
    source: string;
};
