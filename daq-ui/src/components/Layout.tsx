import Head from "next/head"
import React from "react";
import EmbedHeightReporter from "@/components/EmbedHeightReporter";

interface LayoutProps {
    children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </Head>
            <EmbedHeightReporter />
            <div className="flex flex-grid  font-orbitron ">
                <main className="main-section">
                    {children}
                </main>
            </div>
        </>
    )
}

