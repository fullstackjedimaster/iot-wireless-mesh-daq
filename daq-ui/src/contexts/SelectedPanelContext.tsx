"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

import { broadcastSelectedTarget, type SelectedTarget } from "@/lib/dock/selection";

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
            attrs: prev?.id === panel ? prev.attrs : {},
            source: "iot-wireless-mesh-daq",
        }));

        broadcastSelectedTarget({
            id: panel,
            attrs: {},
            source: "iot-wireless-mesh-daq",
        });
    }, []);

    const setSelectedTarget = useCallback((target: SelectedTarget) => {
        setSelectedTargetState(target);
        setSelectedPanelState(target.id);

        broadcastSelectedTarget(target);
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