// /daq-ui/src/pages/_app.tsx
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import "@/app/globals.css";

const DOCK_ORIGIN = "https://ai-ui.fullstackjedi.dev";
const DOCK_FRAME_ID = "daq-dock";
const WRAPPER_ID = "dock-wrapper-" + DOCK_FRAME_ID;

export default function MyApp({ Component, pageProps }: AppProps) {
    const [dockVisible, setDockVisible] = useState(false);

    // Receive parent visibility commands
    useEffect(() => {
        const onMsg = (ev: MessageEvent) => {
            const d = ev?.data;
            if (!d || typeof d !== "object") return;
            if (d.type === "SET_DOCK_VISIBLE") setDockVisible(!!d.visible);
        };
        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []);

    // Imperative injector for boot.js (so it runs every time we show the dock)
    useEffect(() => {
        if (!dockVisible) {
            // remove wrapper if present
            const wrap = document.getElementById(WRAPPER_ID);
            if (wrap && wrap.parentElement) wrap.parentElement.removeChild(wrap);

            // nudge parent to re-measure; prevents lingering skinny scrollbars
            try {
                window.dispatchEvent(new Event("resize"));
                const frameId =
                    new URLSearchParams(location.search).get("frameId") || undefined;
                const height = document.documentElement.scrollHeight;
                window.parent?.postMessage({ type: "EMBED_HEIGHT", frameId, height }, "*");
            } catch {}
            return;
        }

        // If visible: inject a fresh boot.js (cache-busted) and let it build the iframe.
        // If the wrapper already exists (e.g., fast toggle), do nothing.
        if (document.getElementById(WRAPPER_ID)) return;

        const s = document.createElement("script");
        s.src = `${DOCK_ORIGIN}/dock/boot.js?v=${Date.now()}`;
        s.defer = true;
        s.dataset.origin = DOCK_ORIGIN;
        s.dataset.visible = "1";
        s.dataset.height  = "420";
        s.dataset.frameId = DOCK_FRAME_ID;
        (document.body || document.documentElement).appendChild(s);

        return () => {
            // no-op on cleanup; wrapper is removed in the 'false' branch
        };
    }, [dockVisible]);

    return (
        <Layout>
            <Component {...pageProps} />
        </Layout>
    );
}
