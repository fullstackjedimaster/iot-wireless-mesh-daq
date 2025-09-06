// /daq-ui/src/pages/index.tsx (or /app/page.tsx if using App Router)
"use client";

import Head from "next/head";
import Layout from "@/components/Layout";
import { PanelMapOverlay, PanelTelemetry } from "@/components/PanelMapOverlay";
import ChartPanel from "@/components/ChartPanel";
import ControlPanel from "@/components/ControlPanel";
import GroupBox from "@/components/GroupBox";
import { useEffect, useState } from "react";
import { getLayout } from "@/lib/api";
import { FaultLegend } from "@/components/FaultLegend";

type LayoutItem = { x: number; y: number; mac: string };

// Generic attribute bag for any host (CRUD, DAQ, etc.)
type Attrs = Record<string, string | number | boolean | null | undefined>;

export default function Home() {
    const [selectedMac, setSelectedMac] = useState<string>("");
    const [currentTelemetry, setCurrentTelemetry] = useState<PanelTelemetry>({});
    const [attrs, setAttrs] = useState<Attrs>({}); // derived from telemetry (generic)

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
        fetchAndSelectFirstPanel();
        return () => {
            mounted = false;
        };
    }, []);

    // Keep a generic attrs object in sync with the current telemetry
    useEffect(() => {
        // Map DAQ telemetry → generic attributes bag
        const next: Attrs = {
            status: currentTelemetry.status ?? undefined,
            voltage: currentTelemetry.voltage ?? undefined,
            current: currentTelemetry.current ?? undefined,
        };
        setAttrs(next);
    }, [currentTelemetry]);

    // Broadcast selection so ai-ui (in a sibling iframe via boot.js) can sync
    // 1) Legacy path (kept for back-compat): PANEL_SELECTED + telemetry
    // 2) Generic path (new): TARGET_SELECTED + { id, attrs }
    useEffect(() => {
        if (!selectedMac) return;

        try {
            // --- Legacy (don’t remove; other relays may still rely on this) ---
            window.parent?.postMessage(
                {
                    type: "PANEL_SELECTED",
                    mac: selectedMac,
                    telemetry: currentTelemetry ?? null,
                    source: "daq-ui",
                },
                "*"
            );

            // --- Generic (preferred going forward) ---
            window.parent?.postMessage(
                {
                    type: "TARGET_SELECTED",
                    id: selectedMac,          // generic identifier (works for CRUD, DAQ, etc.)
                    attrs: attrs ?? null,     // generic attributes (optional)
                    source: "daq-ui",
                },
                "*"
            );
        } catch {
            /* no-op */
        }
    }, [selectedMac, currentTelemetry, attrs]);

    return (
        <>
            <Head>
                <title>Wireless Mesh DAQ Dashboard</title>
            </Head>

            <Layout>
                <div className="w-full">
                    <h1 className="header">Wireless Mesh DAQ Dashboard</h1>

                    <GroupBox title="Nodes">
                        <PanelMapOverlay
                            selectedMac={selectedMac}
                            onPanelClick={setSelectedMac}
                            onSelectionMeta={(mac, telem) => {
                                // Keep local telemetry; broadcasting happens via the effect above
                                if (mac === selectedMac) setCurrentTelemetry(telem);
                            }}
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
            </Layout>
        </>
    );
}
