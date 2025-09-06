"use client";

import Head from "next/head";
import Layout from "@/components/Layout";
import { PanelMapOverlay } from "@/components/PanelMapOverlay";
import ChartPanel from "@/components/ChartPanel";
import ControlPanel from "@/components/ControlPanel";
import GroupBox from "@/components/GroupBox";
import { useEffect, useState } from "react";
import { getLayout } from "@/lib/api";
import { FaultLegend } from "@/components/FaultLegend";

/** Expected layout item shape returned by getLayout() */
type LayoutItem = {
    x: number;
    y: number;
    mac: string;
};

export default function Home() {
    const [selectedMac, setSelectedMac] = useState<string>("");

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
                // ignore (keep current selection)
            }
        };

        fetchAndSelectFirstPanel();
        return () => {
            mounted = false;
        };
    }, []);

    // Broadcast selected MAC so ai-ui (in a sibling iframe) can sync
    useEffect(() => {
        if (!selectedMac) return;
        try {
            window.parent?.postMessage({ type: "SELECT_MAC", mac: selectedMac }, "*");
        } catch {
            /* no-op */
        }
    }, [selectedMac]);

    return (
        <>
            <Head>
                <title>Wireless Mesh DAQ Dashboard</title>
            </Head>

            <Layout>
                <div className="w-full">
                    <h1 className="header">Wireless Mesh DAQ Dashboard</h1>

                    <GroupBox title="Nodes">
                        <PanelMapOverlay selectedMac={selectedMac} onPanelClick={setSelectedMac} />
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
