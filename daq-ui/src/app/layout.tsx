// ui-daq/src/app/layout.tsx
import "@/app/globals.css";

import type {
    ReactNode,
} from "react";

import DockHost from "@/components/dock/DockHost";
import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import { SelectedPanelProvider } from "@/contexts/SelectedPanelContext";

type RootLayoutProps = {
    children: ReactNode;
};

export default function RootLayout({
    children,
}: RootLayoutProps) {
    return (
        <html lang="en">
            <body>
                <SelectedPanelProvider>
                    {/*
                     * This is the one explicit element whose
                     * rendered height controls the outer
                     * portfolio iframe.
                     *
                     * It must contain both the DAQ page and
                     * the dynamically resizing RAG dock.
                     */}
                    <div id="daq-embed-content">
                        {children}

                        <DockHost />
                    </div>

                    {/*
                     * Keep the reporter outside the measured
                     * root so it cannot affect that root's
                     * height.
                     */}
                    <EmbedHeightReporter />
                </SelectedPanelProvider>
            </body>
        </html>
    );
}