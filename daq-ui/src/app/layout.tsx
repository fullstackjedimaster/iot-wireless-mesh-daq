import "@/app/globals.css";

import type { ReactNode } from "react";

import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import EmbedTokenListener from "@/components/EmbedTokenListener";
import RagDockLoader from "@/components/RagDockLoader";
import { SelectedPanelProvider } from "@/contexts/SelectedPanelContext";
import { settings } from "@/lib/settings";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <EmbedTokenListener />
                <SelectedPanelProvider>
                    <div id="daq-embed-content">
                        <div id="rag-dock" />
                        {children}
                    </div>
                    <RagDockLoader
                        scriptUrl={settings.DOCK_SCRIPT_URL}
                        target="#rag-dock"
                        app={settings.HOST_APP_ID}
                        density={settings.HOST_DENSITY}
                    />
                    <EmbedHeightReporter contentRootId="daq-embed-content" />
                </SelectedPanelProvider>
            </body>
        </html>
    );
}
