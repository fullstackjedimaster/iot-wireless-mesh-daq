"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Record<string, AttrValue>;

export type SelectedTarget = {
    id: string;
    attrs?: Attrs;
    source?: string;
};

type SelectedPanelContextValue = {
    selectedPanel: string | null;
    setSelectedPanel: (panel: string) => void;

    selectedTarget: SelectedTarget | null;
    setSelectedTarget: (target: SelectedTarget) => void;
};

const SelectedPanelContext = createContext<SelectedPanelContextValue>({
    selectedPanel: null,
    setSelectedPanel: () => {},

    selectedTarget: null,
    setSelectedTarget: () => {},
});

export const SelectedPanelProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedPanel, setSelectedPanelState] = useState<string | null>(null);
    const [selectedTarget, setSelectedTargetState] = useState<SelectedTarget | null>(null);

    const setSelectedPanel = useCallback((panel: string) => {
        setSelectedPanelState(panel);
        setSelectedTargetState((prev) => ({
            id: panel,
            attrs: prev?.id === panel ? prev.attrs : undefined,
            source: "daq-ui",
        }));

        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("panel-selected", {
                    detail: {
                        mac: panel,
                        id: panel,
                        attrs: undefined,
                        source: "daq-ui",
                    },
                })
            );
        }
    }, []);

    const setSelectedTarget = useCallback((target: SelectedTarget) => {
        setSelectedTargetState(target);
        setSelectedPanelState(target.id);

        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("panel-selected", {
                    detail: {
                        mac: target.id,
                        id: target.id,
                        attrs: target.attrs,
                        source: target.source ?? "daq-ui",
                    },
                })
            );
        }
    }, []);

    const value = useMemo<SelectedPanelContextValue>(
        () => ({
            selectedPanel,
            setSelectedPanel,
            selectedTarget,
            setSelectedTarget,
        }),
        [selectedPanel, setSelectedPanel, selectedTarget, setSelectedTarget]
    );

    return (
        <SelectedPanelContext.Provider value={value}>
            {children}
        </SelectedPanelContext.Provider>
    );
};

export function useSelectedPanel() {
    return useContext(SelectedPanelContext);
}

export function useSelectedTarget() {
    return useContext(SelectedPanelContext);
}