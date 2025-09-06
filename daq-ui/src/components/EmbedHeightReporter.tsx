"use client";

import { useEffect } from "react";

type Beacon = {
    type: "EMBED_HEIGHT";
    frameId?: string;
    height: number;
};

export default function EmbedHeightReporter() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const frameId = params.get("frameId") || undefined;

        let scheduled = false;
        let lastSent = 0;

        // Use ResizeObserver for true layout size
        const ro = new ResizeObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
                scheduled = false;
                const body = document.body;
                const html = document.documentElement;

                // Use the max of body and doc element scroll heights
                const h = Math.max(
                    body.scrollHeight,
                    html.scrollHeight,
                    body.offsetHeight,
                    html.offsetHeight
                );

                // Avoid spamming the parent with 1–2px jitter
                if (Math.abs(h - lastSent) >= 4) {
                    lastSent = h;
                    const msg: Beacon = { type: "EMBED_HEIGHT", frameId, height: h };
                    window.parent?.postMessage(msg, "*");
                }
            });
        });

        ro.observe(document.documentElement);
        ro.observe(document.body);

        // MutationObserver fallback — just trigger ResizeObserver manually
        const mo = new MutationObserver(() => {
            ro.disconnect();
            ro.observe(document.documentElement);
            ro.observe(document.body);
        });

        mo.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: true,
        });

        // Initial ping
        const init = () => {
            const h = Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            );
            lastSent = h;
            const msg: Beacon = { type: "EMBED_HEIGHT", frameId, height: h };
            window.parent?.postMessage(msg, "*");
        };
        init();

        return () => {
            ro.disconnect();
            mo.disconnect();
        };
    }, []);

    return null;
}
