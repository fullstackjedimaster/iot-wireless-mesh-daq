"use client";

import { useEffect } from "react";

export default function EmbedHeightReporter() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const frameId = params.get("frameId") || undefined;

        let rafScheduled = false;
        let lastSent = 0;

        // Robust height calc that won't "creep"
        const computeHeight = () => {
            const html = document.documentElement;
            const body = document.body;

            // Use layout height; avoid scroll-driven feedback loops
            const rect = body.getBoundingClientRect();
            const layoutH = Math.ceil(rect.height);

            // Fallbacks if styles are odd
            const alt = Math.max(
                html.clientHeight,
                html.offsetHeight,
                body.scrollHeight,
                body.offsetHeight
            );

            return Math.max(layoutH, alt);
        };

        const post = (h: number) => {
            if (!window.parent) return;
            // Only send if changed meaningfully (>= 8px)
            if (Math.abs(h - lastSent) < 8) return;
            lastSent = h;
            window.parent.postMessage(
                { type: "EMBED_HEIGHT", frameId, height: h },
                "*"
            );
        };

        const measureAndPost = () => {
            if (rafScheduled) return;
            rafScheduled = true;
            requestAnimationFrame(() => {
                rafScheduled = false;
                post(computeHeight());
            });
        };

        // ResizeObserver: layout changes
        const ro = new ResizeObserver(() => measureAndPost());
        ro.observe(document.documentElement);
        ro.observe(document.body);

        // MutationObserver: DOM edits
        const mo = new MutationObserver(() => measureAndPost());
        mo.observe(document.body, { childList: true, subtree: true, attributes: true });

        // Initial + after fonts/images
        measureAndPost();
        window.addEventListener("load", measureAndPost);
        const id = setInterval(measureAndPost, 1000); // safety ping

        return () => {
            window.removeEventListener("load", measureAndPost);
            clearInterval(id);
            ro.disconnect();
            mo.disconnect();
        };
    }, []);

    return null;
}
