"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";


import ChartPanel from "@/components/ChartPanel";
import ControlPanel from "@/components/ControlPanel";
import { FaultLegend } from "@/components/FaultLegend";
import PanelMapOverlay, { type PanelTelemetry } from "@/components/PanelMapOverlay";
import { BlinkyThing } from "@/components/BlinkyThing";
import { getLayout } from "@/lib/api";
import { useSelectedTarget } from "@/contexts/SelectedPanelContext";
import LogPanel from "@/components/LogPanel";
import type { Attrs } from "@/lib/dock/selection";

type LayoutItem = { x: number; y: number; mac: string };

export default function HomePage() {
    const { setSelectedTarget } = useSelectedTarget();

    const [selectedMac, setSelectedMac] = useState<string>("");
    const [currentTelemetry, setCurrentTelemetry] = useState<PanelTelemetry>({});

    const handlePanelClick = useCallback((mac: string) => {
        setSelectedMac(mac);
    }, []);

    const handleSelectionMeta = useCallback((mac: string, telem: PanelTelemetry) => {
        setSelectedMac(mac);
        setCurrentTelemetry(telem);
    }, []);

    const attrs: Attrs = useMemo(() => {
        return {
            status: currentTelemetry.status ?? undefined,
            voltage: currentTelemetry.voltage ?? undefined,
            current: currentTelemetry.current ?? undefined,
            power: currentTelemetry.power ?? undefined,
            temperature: currentTelemetry.temperature ?? undefined,
        };
    }, [currentTelemetry]);

    useEffect(() => {
        let mounted = true;

        const run = async () => {
            const layout: LayoutItem[] = await getLayout();

            if (!mounted) return;

            if (!Array.isArray(layout) || layout.length === 0) {
                throw new Error("[page] getLayout() returned empty/invalid layout.");
            }

            const sorted = [...layout].sort((a, b) =>
                a.y !== b.y ? a.y - b.y : a.x - b.x
            );

            const first = sorted[0]?.mac;

            if (!first) {
                throw new Error("[page] layout missing mac for first panel.");
            }

            setSelectedMac(first);
        };

        void run();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedMac) return;

        const selectedTarget = {
            id: selectedMac,
            attrs,
            source: "daq-ui",
        };

        setSelectedTarget(selectedTarget);

        window.dispatchEvent(
            new CustomEvent("panel-selected", {
                detail: {
                    mac: selectedMac,
                    id: selectedMac,
                    attrs,
                    source: "daq-ui",
                },
            })
        );
    }, [selectedMac, attrs, setSelectedTarget]);


    return (
        <main className="w-full overflow-x-hidden pb-4" style={{ width: "100%", maxWidth: "100%" }}>
            <h1 className="header">Wireless Mesh DAQ Dashboard</h1>
            <fieldset className="fieldset-section">
                <legend>
                    Logs
                </legend>
                <div
                    className="daq-log-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr)",
                        gap: "8px",
                        width: "100%",
                        minWidth: 0,
                    }}
                >
                    <LogPanel title="Mesh Logs" source="mesh" />
                    <LogPanel title="Cloud Logs" source="cloud" />
                </div>
            </fieldset>
            <fieldset className="fieldset-section">
                <legend>
                    Nodes
                </legend>
                <PanelMapOverlay
                    selectedMac={selectedMac}
                    onPanelClick={handlePanelClick}
                    onSelectionMeta={handleSelectionMeta}
                />

                <FaultLegend />
            </fieldset>
            <fieldset className="fieldset-section">
                <legend>
                    {`DAQ:  ${selectedMac || "—"}`}
                </legend>
                <ChartPanel selectedMac={selectedMac} />
            </fieldset>
            <fieldset className="fieldset-section">
                <legend>
                    Fault Injection
                </legend>
                <ControlPanel />
            </fieldset>

            <div className="fixed bottom-3 right-3 z-40 pointer-events-none">
                <BlinkyThing
                    size={36}
                    dotSize={7}
                    gap={6}
                    colors={["#22d3ee", "#f59e0b", "#ef4444"]}
                    intervalMs={800}
                    framed={false}
                    stealth
                    ariaLabel="Purely decorative blinking lights"
                />
            </div>
        </main>
    );
}