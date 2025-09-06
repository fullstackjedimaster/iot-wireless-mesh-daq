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

export default function Home() {
    const [selectedMac, setSelectedMac] = useState<string>("");
    const [currentTelemetry, setCurrentTelemetry] = useState<PanelTelemetry>({});

    // On first load, select the top-left panel by (y, then x)
    useEffect(() => {
        let mounted = true;
        const fetchAndSelectFirstPanel = async () => {
            try {
                const layout: LayoutItem[] = await getLayout();
                if (!mounted || !Array.isArray(layout) || layout.length === 0) return;
                const sorted = [...layout].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
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

    // Broadcast selection + telemetry so ai-ui (sibling iframe) can sync
    useEffect(() => {
        if (!selectedMac) return;
        try {
            window.parent?.postMessage(
                {
                    type: "PANEL_SELECTED",
                    mac: selectedMac,
                    telemetry: currentTelemetry ?? null,
                    source: "daq-ui",
                },
                "*"
            );
        } catch {
            /* no-op */
        }
    }, [selectedMac, currentTelemetry]);

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
                                // keep local telemetry (for dock or future UI) and trigger postMessage via effect
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
