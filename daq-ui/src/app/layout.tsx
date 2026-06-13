import "@/app/globals.css";
import type { ReactNode } from "react";
import DockHost from "@/components/dock/DockHost";
import { SelectedPanelProvider } from "@/contexts/SelectedPanelContext";
import  EmbedHeightReporter  from "@/components/EmbedHeightReporter";
export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body>
                <SelectedPanelProvider>

                    {children}
                    <EmbedHeightReporter />
                     <DockHost />
                </SelectedPanelProvider>
            </body>
        </html>
    );
}