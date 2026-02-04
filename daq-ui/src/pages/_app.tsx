import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import "@/app/globals.css";

const DOCK_ORIGIN = "https://rag.fullstackjedi.dev";
const DOCK_FRAME_ID = "daq-dock";
const WRAPPER_ID = "dock-wrapper-" + DOCK_FRAME_ID;

// Minimal messages host cares about receiving
type DockToHost =
    | { type: "DOCK_READY"; version?: number }
    | { type: "DOCK_HEIGHT"; height?: number };

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null;
}

export default function MyApp({ Component, pageProps }: AppProps) {
    // For now: always show dock (you can later wire a toggle button)
    const [dockVisible] = useState(true);

    // Listen for dock messages (ready + height)
    useEffect(() => {
        const onMsg = (ev: MessageEvent<unknown>) => {
            if (ev.origin !== DOCK_ORIGIN) return;
            const d = ev.data;
            if (!isObject(d)) return;

            const type = d["type"];
            if (type === "DOCK_READY") {
                // optional: log, or set state if you want
                // console.debug("[dock] ready");
            } else if (type === "DOCK_HEIGHT") {
                const h = Number(d["height"]);
                if (!Number.isFinite(h) || h <= 0) return;

                // resize the dock iframe
                const iframe = document.getElementById(DOCK_FRAME_ID) as HTMLIFrameElement | null;
                if (iframe) iframe.style.height = `${Math.max(120, Math.min(900, h))}px`;
            }
        };

        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []);

    // Inject dock boot.js (host-side)
    useEffect(() => {
        const removeDock = () => {
            const wrap = document.getElementById(WRAPPER_ID);
            if (wrap && wrap.parentElement) wrap.parentElement.removeChild(wrap);
        };

        const injectDock = () => {
            if (!dockVisible) {
                removeDock();
                return;
            }

            if (document.getElementById(WRAPPER_ID)) return;

            const s = document.createElement("script");
            s.src = `${DOCK_ORIGIN}/dock/boot.js?v=${Date.now()}`;
            s.defer = true;

            // pass settings via data-attrs
            s.dataset.origin = DOCK_ORIGIN;
            s.dataset.frameId = DOCK_FRAME_ID;
            s.dataset.height = "420";
            s.dataset.usecase = "mesh_daq_faults"; // default usecase for this host
            s.dataset.visible = "1";

            (document.body || document.documentElement).appendChild(s);
        };

        injectDock();

        // Small retry: sometimes script loads before DOM stable
        const t = setTimeout(() => {
            if (dockVisible && !document.getElementById(WRAPPER_ID)) injectDock();
        }, 300);

        return () => clearTimeout(t);
    }, [dockVisible]);

    return (
        <Layout>
            <Component {...pageProps} />
        </Layout>
    );
}
