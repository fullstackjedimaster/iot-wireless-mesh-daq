// daq-ui/src/components/EmbedHeightReporter.tsx
"use client";
import { useEffect } from "react";

export default function EmbedHeightReporter() {
    useEffect(() => {
        const frameId = new URLSearchParams(location.search).get("frameId") || "iframe-1";

        const contentHeight = () =>
            Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

        const post = (h: number) => {
            window.parent?.postMessage({ type: "EMBED_HEIGHT", frameId, height: Math.ceil(h) }, "*");
        };

        let last = 0;
        const rafId: number | null = null;

        let debounceTimer: number | null = null;
        const send = () => {
            if (debounceTimer !== null) clearTimeout(debounceTimer);
            // @ts-expect-error cuz
            debounceTimer = setTimeout(() => {
                debounceTimer = null;
                const h = contentHeight();
                if (!Number.isFinite(h) || h <= 0 || Math.abs(h - last) < 2) return;
                last = h;
                post(h);
            }, 100);  // Delay a bit to let styles settle
        };


        // Initial + observers
        send();
        const ro = new ResizeObserver(send);
        ro.observe(document.documentElement);
        const mo = new MutationObserver(send);
        mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        addEventListener("load", send);
        addEventListener("resize", send);

        const t = setInterval(send, 500); // belt & suspenders

        return () => {
            ro.disconnect();
            mo.disconnect();
            removeEventListener("load", send);
            removeEventListener("resize", send);
            if (rafId != null) cancelAnimationFrame(rafId);
            clearInterval(t);
        };
    }, []);

    return null;
}
