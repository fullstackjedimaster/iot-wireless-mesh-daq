// /daq-ui/src/pages/index.tsx  (or /apps/page.tsx)
"use client";

import Head from "next/head";
import GroupBox from "@/components/GroupBox";
import ChartPanel from "@/components/ChartPanel";
import ControlPanel from "@/components/ControlPanel";
import { FaultLegend } from "@/components/FaultLegend";
import { PanelMapOverlay, type PanelTelemetry } from "@/components/PanelMapOverlay";
import { useCallback, useEffect, useState } from "react";
import { getLayout } from "@/lib/api";
import { BlinkyThing } from "@/components/BlinkyThing";
import DockReadyReporter from "@/components/DockReadyReporter";

// Layout items returned by getLayout()
type LayoutItem = { x: number; y: number; mac: string };

// Generic attribute bag (used when broadcasting TARGET_SELECTED)
type Attrs = Record<string, string | number | boolean | null | undefined>;

export default function Home() {
    const [selectedMac, setSelectedMac] = useState<string>("");
    const [currentTelemetry, setCurrentTelemetry] = useState<PanelTelemetry>({});
    const [attrs, setAttrs] = useState<Attrs>({}); // derived from telemetry (generic)

    // Click from the map
    const handlePanelClick = useCallback((mac: string) => {
        setSelectedMac(mac);
    }, []);

    // PanelMapOverlay will call this with telemetry whenever a panel is clicked
    const handleSelectionMeta = useCallback((mac: string, telem: PanelTelemetry) => {
        // keep local state up to date; broadcast happens in the effect below
        setSelectedMac(mac);
        setCurrentTelemetry(telem);
    }, []);

    // On first load, select the top-left panel by (y, then x)
    useEffect(() => {
        let mounted = true;
        const fetchAndSelectFirstPanel = async () => {
            try {
                const layout: LayoutItem[] = await getLayout();
                if (!mounted || !Array.isArray(layout) || layout.length === 0) return;
                const sorted = [...layout].sort((a, b) =>
                    a.y !== b.y ? a.y - b.y : a.x - b.x
                );
                setSelectedMac(sorted[0]?.mac ?? "");
            } catch {
                /* ignore */
            }
        };
        void fetchAndSelectFirstPanel();
        return () => {
            mounted = false;
        };
    }, []);

    // Keep a generic attrs object in sync with the current telemetry
    useEffect(() => {
        const next: Attrs = {
            status: currentTelemetry.status ?? undefined,
            voltage: currentTelemetry.voltage ?? undefined,
            current: currentTelemetry.current ?? undefined,
        };
        setAttrs(next);
    }, [currentTelemetry]);

    // Broadcast selection so ai-ui (in sibling iframe via portfolio) can sync
    // 1) Legacy path (kept for back-compat): PANEL_SELECTED + telemetry
    // 2) Generic path (preferred): TARGET_SELECTED + { id, attrs }
    useEffect(() => {
        if (!selectedMac) return;
        try {
            // --- Legacy ---
            window.parent?.postMessage(
                {
                    type: "PANEL_SELECTED",
                    mac: selectedMac,
                    telemetry: currentTelemetry ?? null,
                    source: "daq-ui",
                },
                "*"
            );

            // --- Preferred generic ---
            window.parent?.postMessage(
                {
                    type: "TARGET_SELECTED",
                    id: selectedMac,      // generic identifier (MAC here)
                    attrs: attrs ?? null, // generic attributes
                    source: "daq-ui",
                },
                "*"
            );
        } catch {
            /* no-op for cross-origin guards */
        }
    }, [selectedMac, currentTelemetry, attrs]);

    return (
        <>
            <Head>
                <title>Wireless Mesh DAQ Dashboard</title>
            </Head>
            <DockReadyReporter />

            <div className="w-full">
                <h1 className="header">Wireless Mesh DAQ Dashboard</h1>

                <GroupBox title="Nodes">
                    <PanelMapOverlay
                        selectedMac={selectedMac}
                        onPanelClick={handlePanelClick}
                        onSelectionMeta={handleSelectionMeta}
                    />
                    <FaultLegend />
                </GroupBox>

                <br />
                <GroupBox title={`DAQ:  ${selectedMac || "—"}`}>
                    <ChartPanel selectedMac={selectedMac} />
                </GroupBox>

                <br />
                <GroupBox title="Fault Injection">
                    <ControlPanel />
                </GroupBox>
            </div>
            <div className="fixed bottom-3 right-3 z-50 pointer-events-none">
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

        </>
    );
}
