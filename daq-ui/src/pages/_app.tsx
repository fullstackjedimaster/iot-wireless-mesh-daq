import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import "@/app/globals.css";

const DOCK_ORIGIN = "https://ai-ui.fullstackjedi.dev";
const DOCK_FRAME_ID = "daq-dock";
const WRAPPER_ID = "dock-wrapper-" + DOCK_FRAME_ID;

export default function MyApp({ Component, pageProps }: AppProps) {
    const [dockVisible, setDockVisible] = useState(false);

    // 1️⃣ Listen for visibility toggle messages from parent (portfolio/testbed)
    useEffect(() => {
        const onMsg = (ev: MessageEvent) => {
            const d = ev?.data;
            if (!d || typeof d !== "object") return;
            if (d.type === "SET_DOCK_VISIBLE") {
                setDockVisible(!!d.visible);
            } else if (d.type === "refreshDock") {
                // optional manual refresh from parent
                setDockVisible(true);
            }
        };
        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []);

    // 2️⃣ Send "AI_SET_USECASE" to parent when opened from testbed host
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const host = params.get("host");
            if (host === "testbed" && window.parent) {
                window.parent.postMessage(
                    { type: "AI_SET_USECASE", usecase: "mesh" },
                    "*"
                );
                // Immediately request a dock refresh handshake
                window.parent.postMessage({ type: "embedReady" }, "*");
            }
        } catch {}
    }, []);

    // 3️⃣ Safe injector for dock boot.js with retry to fix missing-dock-on-first-load
    useEffect(() => {
        const injectDock = () => {
            if (!dockVisible) {
                const wrap = document.getElementById(WRAPPER_ID);
                if (wrap && wrap.parentElement) wrap.parentElement.removeChild(wrap);

                try {
                    window.dispatchEvent(new Event("resize"));
                    const frameId =
                        new URLSearchParams(location.search).get("frameId") || undefined;
                    const height = document.documentElement.scrollHeight;
                    window.parent?.postMessage(
                        { type: "EMBED_HEIGHT", frameId, height },
                        "*"
                    );
                } catch {}
                return;
            }

            if (document.getElementById(WRAPPER_ID)) return;

            const s = document.createElement("script");
            s.src = `${DOCK_ORIGIN}/dock/boot.js?v=${Date.now()}`;
            s.defer = true;
            s.dataset.origin = DOCK_ORIGIN;
            s.dataset.visible = "1";
            s.dataset.height = "420";
            s.dataset.frameId = DOCK_FRAME_ID;
            (document.body || document.documentElement).appendChild(s);
        };

        // Attempt immediate injection and retry once after short delay
        injectDock();
        const retryTimer = setTimeout(() => {
            if (!document.getElementById(WRAPPER_ID) && dockVisible) {
                console.debug("[dock] retrying injection after initial delay");
                injectDock();
            }
        }, 500);

        return () => clearTimeout(retryTimer);
    }, [dockVisible]);

    return (
        <Layout>
            <Component {...pageProps} />
        </Layout>
    );
}
