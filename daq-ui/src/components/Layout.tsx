// daq-ui/src/components/Layout.tsx
import Head from "next/head";
import React from "react";
import EmbedHeightReporter from "@/components/EmbedHeightReporter";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Head><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
            <EmbedHeightReporter />
            <div className="flex flex-grid font-orbitron">
                <main className="main-section">{children}</main>
            </div>
        </>
    );
}
