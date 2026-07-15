// ui-daq/src/app/layout.tsx
import "@/app/globals.css";

import type { ReactNode } from "react";

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
                    <div id="daq-embed-content">
                        {children}
                        <DockHost />
                    </div>

                    <EmbedHeightReporter />
                </SelectedPanelProvider>
            </body>
        </html>
    );
}