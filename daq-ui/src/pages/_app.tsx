// /daq-ui/src/pages/_app.tsx
import type { AppProps } from "next/app";
import Script from "next/script";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import "@/app/globals.css";

const DOCK_ORIGIN = "https://ai-ui.fullstackjedi.dev";
const DOCK_FRAME_ID = "daq-dock";
const WRAPPER_ID = "dock-wrapper-" + DOCK_FRAME_ID;

export default function MyApp({ Component, pageProps }: AppProps) {
    const [dockVisible, setDockVisible] = useState(false);

    // Listen for parent directive
    useEffect(() => {
        const onMsg = (ev: MessageEvent) => {
            const d = ev?.data;
            if (!d || typeof d !== "object") return;
            if (d.type === "SET_DOCK_VISIBLE") {
                const want = !!d.visible;
                setDockVisible(want);
            }
        };
        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []);

    // If dock is turned off after being on, remove the injected iframe wrapper
    useEffect(() => {
        if (dockVisible) return;
        const wrap = document.getElementById(WRAPPER_ID);
        if (wrap && wrap.parentElement) {
            wrap.parentElement.removeChild(wrap);
        }
    }, [dockVisible]);

    return (
        <Layout>
            {dockVisible && (
                <Script
                    src={`${DOCK_ORIGIN}/dock/boot.js`}
                    strategy="afterInteractive"
                    data-origin={DOCK_ORIGIN}
                    data-visible="1"
                    data-height="420"
                    data-frame-id={DOCK_FRAME_ID}
                />
            )}
            <Component {...pageProps} />
        </Layout>
    );
}
