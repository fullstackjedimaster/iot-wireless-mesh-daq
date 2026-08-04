"use client";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { BlinkyThing } from "@/components/BlinkyThing";
import ChartPanel from "@/components/ChartPanel";
import ControlPanel from "@/components/ControlPanel";
import DemoShell from "@/components/demo-shell/DemoShell";
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

    const attrs: Attrs = useMemo(
        () => ({
            status: currentTelemetry.status,
            voltage: currentTelemetry.voltage,
            current: currentTelemetry.current,
            power: currentTelemetry.power,
            temperature: currentTelemetry.temperature,
            irradiance: currentTelemetry.irradiance,
            expected_power: currentTelemetry.expected_power,
            performance_ratio: currentTelemetry.performance_ratio,
            environmental_state:
                currentTelemetry.environmental_state,
            diagnostic_basis: currentTelemetry.diagnostic_basis,
        }),
        [currentTelemetry],
    );

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
                    "[demo/page] First layout item has no MAC address.",
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
        <DemoShell
            eyebrow="Solar IoT"
            title="Wireless Mesh DAQ Demo"
            directions="Select a panel, then choose and trigger a fault to simulate field conditions. Watch the electrical and environmental telemetry respond."
            status={
                selectedMac
                    ? `Selected: ${selectedMac}`
                    : "Connecting"
            }
        >
            {/*
              `daq-demo-app` is only a layout boundary. All visual styling
              inside it continues to come from Mesh DAQ's existing globals.css.
            */}
            <div
                className="daq-demo-app"
                style={{
                    width: "min(420px, 100%)",
                    margin: "0 auto",
                }}
            >
                <fieldset className="fieldset-section">
                    <legend>Logs</legend>
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
                        <LogPanel
                            title="Mesh Logs"
                            source="mesh"
                        />
                        <LogPanel
                            title="Cloud Logs"
                            source="cloud"
                        />
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

            <div className="fixed bottom-3 right-3 z-40 pointer-events-none">
                <BlinkyThing
                    size={36}
                    dotSize={7}
                    gap={6}
                    colors={[
                        "#22d3ee",
                        "#f59e0b",
                        "#ef4444",
                    ]}
                    intervalMs={800}
                    framed={false}
                    stealth
                    ariaLabel="Purely decorative blinking lights"
                />
            </div>
        </DemoShell>
    );
}
