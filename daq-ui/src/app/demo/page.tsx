"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { BlinkyThing } from "@/components/BlinkyThing";
import ChartPanel from "@/components/ChartPanel";
import ControlPanel from "@/components/ControlPanel";
import { FaultLegend } from "@/components/FaultLegend";
import LogPanel from "@/components/LogPanel";
import PanelMapOverlay, {
    type PanelTelemetry,
} from "@/components/PanelMapOverlay";
import { useSelectedTarget } from "@/contexts/SelectedPanelContext";
import type { Attrs } from "@/lib/dock/messages";
import { getLayout } from "@/lib/api";

type LayoutItem = {
    x: number;
    y: number;
    mac: string;
};

export default function MeshDaqDemoPage() {
    const { setSelectedTarget } = useSelectedTarget();

    const [selectedMac, setSelectedMac] = useState("");
    const [currentTelemetry, setCurrentTelemetry] =
        useState<PanelTelemetry>({});

    const handlePanelClick = useCallback((mac: string) => {
        setSelectedMac(mac);
    }, []);

    const handleSelectionMeta = useCallback(
        (mac: string, telemetry: PanelTelemetry) => {
            setSelectedMac(mac);
            setCurrentTelemetry(telemetry);
        },
        [],
    );

    const attrs = useMemo(
        () => ({
            status: currentTelemetry.status ?? undefined,
            voltage: currentTelemetry.voltage ?? undefined,
            current: currentTelemetry.current ?? undefined,
            power: currentTelemetry.power ?? undefined,
            temperature: currentTelemetry.temperature ?? undefined,
            irradiance: currentTelemetry.irradiance ?? undefined,
        }),
        [currentTelemetry],
    ) as Attrs & { irradiance?: string };

    useEffect(() => {
        let mounted = true;

        const selectInitialPanel = async () => {
            const layout: LayoutItem[] = await getLayout();

            if (!mounted) return;

            if (!Array.isArray(layout) || layout.length === 0) {
                throw new Error(
                    "[demo/page] getLayout() returned an empty or invalid layout.",
                );
            }

            const sorted = [...layout].sort((a, b) =>
                a.y !== b.y ? a.y - b.y : a.x - b.x,
            );

            const firstMac = sorted[0]?.mac;

            if (!firstMac) {
                throw new Error(
                    "[demo/page] The first layout item does not contain a MAC address.",
                );
            }

            setSelectedMac(firstMac);
        };

        void selectInitialPanel();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedMac) return;

        setSelectedTarget({
            id: selectedMac,
            attrs,
            source: "iot-wireless-mesh-daq",
        });
    }, [selectedMac, attrs, setSelectedTarget]);

    return (
        <main className="daq-demo-shell">
            <header className="daq-demo-hero">
                <p className="daq-demo-eyebrow">
                    Solar IoT · Wireless Telemetry
                </p>
                <h1>Wireless Mesh DAQ Dashboard</h1>
                <p>
                    A live monitoring and fault-injection interface for a
                    wireless photovoltaic data-acquisition mesh. Select a node
                    to inspect telemetry, review device and cloud logs, and
                    simulate field faults.
                </p>
            </header>

            <section
                className="daq-demo-card"
                aria-label="Wireless Mesh DAQ interactive demo"
            >
                <div className="daq-demo-card-heading">
                    <div>
                        <p className="daq-demo-card-kicker">Live system</p>
                        <h2>Mesh Operations Console</h2>
                    </div>
                    <span className="daq-demo-status-pill">
                        {selectedMac ? `Selected: ${selectedMac}` : "Connecting"}
                    </span>
                </div>

                <div className="daq-demo-console">
                    <fieldset className="fieldset-section">
                        <legend>Logs</legend>
                        <div className="daq-log-grid">
                            <LogPanel title="Mesh Logs" source="mesh" />
                            <LogPanel title="Cloud Logs" source="cloud" />
                        </div>
                    </fieldset>

                    <fieldset className="fieldset-section">
                        <legend>Nodes</legend>
                        <PanelMapOverlay
                            selectedMac={selectedMac}
                            onPanelClick={handlePanelClick}
                            onSelectionMeta={handleSelectionMeta}
                        />
                        <FaultLegend />
                    </fieldset>

                    <fieldset className="fieldset-section">
                        <legend>{`DAQ: ${selectedMac || "—"}`}</legend>
                        <ChartPanel selectedMac={selectedMac} />
                    </fieldset>

                    <fieldset className="fieldset-section">
                        <legend>Fault Injection</legend>
                        <ControlPanel />
                    </fieldset>
                </div>
            </section>

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
