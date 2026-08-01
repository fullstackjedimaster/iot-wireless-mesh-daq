// ui-daq/src/app/layout.tsx
import "@/app/globals.css";

import type { ReactNode } from "react";

import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import { SelectedPanelProvider } from "@/contexts/SelectedPanelContext";
import { settings } from "@/lib/settings";



type RootLayoutProps = {
    children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html lang="en">
            <body>
                <SelectedPanelProvider>
                    <div id="daq-embed-content">
                        <div id="rag-dock" />
                        {children}
                    </div>

                    <script
                        src={settings.DOCK_SCRIPT_URL}
                        data-target="#rag-dock"
                        data-app={settings.HOST_APP_ID}
                        data-density={settings.HOST_DENSITY}
                        defer
                    />

                    <EmbedHeightReporter />
                </SelectedPanelProvider>
            </body>
        </html>
    );
}
