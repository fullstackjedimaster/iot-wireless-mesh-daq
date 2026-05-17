"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import GroupBox from "@/components/GroupBox";
import ChartPanel from "@/components/ChartPanel";
import ControlPanel from "@/components/ControlPanel";
import { FaultLegend } from "@/components/FaultLegend";
import PanelMapOverlay, { type PanelTelemetry } from "@/components/PanelMapOverlay";
import { BlinkyThing } from "@/components/BlinkyThing";
import { getLayout } from "@/lib/api";
import { useSelectedTarget } from "@/contexts/SelectedPanelContext";
import type { Attrs } from "@/lib/dock/selection";

type LayoutItem = { x: number; y: number; mac: string };

function postHostHeight() {
    if (typeof window === "undefined") return;

    const body = document.body;
    const html = document.documentElement;

    const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
    );

    window.parent.postMessage(
        {
            type: "HOST_APP_HEIGHT",
            height: height + 24,
        },
        "*"
    );
}

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

    useEffect(() => {
        postHostHeight();

        const observer = new ResizeObserver(() => {
            postHostHeight();
        });

        observer.observe(document.body);

        window.addEventListener("load", postHostHeight);
        window.addEventListener("resize", postHostHeight);

        const timer = window.setInterval(postHostHeight, 500);

        return () => {
            observer.disconnect();
            window.removeEventListener("load", postHostHeight);
            window.removeEventListener("resize", postHostHeight);
            window.clearInterval(timer);
        };
    }, []);

    return (
        <main className="w-full overflow-hidden pb-4">
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