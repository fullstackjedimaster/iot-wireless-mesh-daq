import "@/app/globals.css";

import type { ReactNode } from "react";

import EmbedHeightReporter from "@/components/EmbedHeightReporter";
import EmbedTokenListener from "@/components/EmbedTokenListener";
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
                    <script
                        src={settings.DOCK_SCRIPT_URL}
                        data-target="#rag-dock"
                        data-app={settings.HOST_APP_ID}
                        data-density={settings.HOST_DENSITY}
                        defer
                    />
                    <EmbedHeightReporter contentRootId="daq-embed-content" />
                </SelectedPanelProvider>
            </body>
        </html>
    );
}
