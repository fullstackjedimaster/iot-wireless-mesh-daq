// daq-ui/src/app/layout.tsx
import "@/app/globals.css";
import type { ReactNode } from "react";
import DockHost from "@/components/dock/DockHost";
import Script from "next/script";
import { SelectedPanelProvider } from "@/contexts/SelectedPanelContext";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
        <body>
        <SelectedPanelProvider>
            {/* Safe to include always; DockHost is inert unless dock iframe exists */}
            <DockHost />
            {children}
            {/* AI dock bootstrapper */}
            <Script
                src="https://rag.fullstackjedi.dev/dock/boot.js"
                strategy="afterInteractive"
                data-origin="https://rag.fullstackjedi.dev"
                data-visible="1"
                data-height="360"
            />
        </SelectedPanelProvider>
        </body>
        </html>
    );
}
