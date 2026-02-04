// daq-ui/src/contexts/SelectedPanelContext.tsx
"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SelectedTarget } from "@/lib/dock/selection";
import { assertNonEmptyString } from "@/lib/dock/selection";

type Listener = (t: SelectedTarget | null) => void;

type Ctx = {
    selectedTarget: SelectedTarget | null;
    setSelectedTarget: (t: SelectedTarget) => void;
    subscribeSelectedTarget: (fn: Listener) => () => void;
};

function assert(condition: unknown, msg: string): asserts condition {
    if (!condition) throw new Error(`[SelectedPanelContext] ${msg}`);
}

const SelectedPanelContext = createContext<Ctx | null>(null);

export function useSelectedTarget(): Ctx {
    const ctx = useContext(SelectedPanelContext);
    assert(ctx, "SelectedPanelProvider missing.");
    return ctx;
}

export function SelectedPanelProvider({ children }: { children: React.ReactNode }) {
    const [selectedTarget, _setSelectedTarget] = useState<SelectedTarget | null>(null);

    // In-memory pubsub (strict). Lives for provider lifetime.
    const listeners = useMemo(() => new Set<Listener>(), []);

    const setSelectedTarget = useCallback(
        (t: SelectedTarget) => {
            assert(t && typeof t === "object", "setSelectedTarget requires a SelectedTarget object.");
            assertNonEmptyString(t.id, "[SelectedPanelContext] setSelectedTarget requires non-empty id.");

            _setSelectedTarget(t);
            for (const fn of listeners) fn(t);
        },
        [listeners]
    );

    const subscribeSelectedTarget = useCallback(
        (fn: Listener) => {
            assert(typeof fn === "function", "subscribeSelectedTarget requires a function.");
            listeners.add(fn);
            fn(selectedTarget); // immediate sync
            return () => listeners.delete(fn);
        },
        [listeners, selectedTarget]
    );

    const value = useMemo<Ctx>(
        () => ({ selectedTarget, setSelectedTarget, subscribeSelectedTarget }),
        [selectedTarget, setSelectedTarget, subscribeSelectedTarget]
    );

    return <SelectedPanelContext.Provider value={value}>{children}</SelectedPanelContext.Provider>;
}
