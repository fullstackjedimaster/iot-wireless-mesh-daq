// daq-ui/src/components/Layout.tsx
import React from "react";
import Head from "next/head";
// import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import "@/app/globals.css";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Head><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
            {/*<EmbedHeightReporter />*/}
            <main className="main-section">{children}</main>
        </>
    );
}
