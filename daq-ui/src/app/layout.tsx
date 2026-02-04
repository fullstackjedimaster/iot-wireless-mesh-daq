// src/app/layout.tsx
import "@/app/globals.css";
import type { ReactNode } from "react";
import DockHost from "@/components/dock/DockHost";
import { SelectedPanelProvider } from "@/contexts/SelectedPanelContext";

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
        <body>
        <SelectedPanelProvider>
            <DockHost />
            {children}
        </SelectedPanelProvider>
        </body>
        </html>
    );
}
