// /daq-ui/src/pages/index.tsx
"use client"

import Head from "next/head"
import Layout from "@/components/Layout"
import { PanelMapOverlay } from "@/components/PanelMapOverlay"
import ChartPanel from "@/components/ChartPanel"
import ControlPanel from "@/components/ControlPanel"
import GroupBox from "@/components/GroupBox"
import { useEffect, useState } from "react"
import { getLayout } from "@/lib/api"
import { FaultLegend } from "@/components/FaultLegend";



export default function Home() {
    const [selectedMac, setSelectedMac] = useState<string>("")

    useEffect(() => {
        const fetchAndSelectFirstPanel = async () => {
            const layout = await getLayout()
            if (layout.length > 0) {
                const sorted = layout.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))
                setSelectedMac(sorted[0].mac)
            }
        }
        fetchAndSelectFirstPanel()
    }, [])

    return (
        <>
            <Head>
                <title>Wireless Mesh DAQ Dashboard</title>
            </Head>

            <Layout>
                <div className="width: 100%">
                    <h1 className="header">Wireless Mesh DAQ Dashboard</h1>

                    <GroupBox title="Nodes">
                        <PanelMapOverlay selectedMac={selectedMac} onPanelClick={setSelectedMac} />
                        <FaultLegend />
                    </GroupBox>

                    <br />
                    <GroupBox title={`DAQ:  ${selectedMac}`}>
                        <ChartPanel selectedMac={selectedMac} />
                    </GroupBox>

                    <br />
                    <GroupBox title="Fault Injection">
                        <ControlPanel />
                    </GroupBox>
                </div>
            </Layout>
        </>
    )
}
