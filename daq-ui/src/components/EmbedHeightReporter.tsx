"use client";

import { useEffect } from "react";

/**
 * Reports the current document height to the parent window for iframe auto-resize.
 * - Snap-rounds to an 8px grid (configurable) to avoid +/-1px oscillation.
 * - Clamps to a sane range to prevent runaway growth.
 * - Reacts to ResizeObserver + MutationObserver + visibility changes + load events.
 * - Sends a periodic keepalive post in case observers miss a change.
 *
 * Parent is expected to listen for { type: "EMBED_HEIGHT", frameId, height }.
 * Child (this document) should be opened with ?frameId=<id> so the parent can match.
 */
export default function EmbedHeightReporter() {
    useEffect(() => {
        // --- Config ---
        const SNAP = 8;               // snap grid in px
        const EXTRA = 8;              // tiny cushion to avoid clipping
        const MIN_H = 120;            // hard lower bound
        const MAX_H = 3000;           // hard upper bound
        const KEEPALIVE_MS = 1200;    // periodic re-post

        // --- Query param for identity ---
        const params = new URLSearchParams(window.location.search);
        const frameId = params.get("frameId") || undefined;

        // --- Runtime CSS guards to avoid phantom pixels/scrollbars ---
        const html = document.documentElement;
        const body = document.body;

        const origHtml = {
            margin: html.style.margin,
            padding: html.style.padding,
            overflowX: html.style.overflowX,
            boxSizing: html.style.boxSizing,
        };
        const origBody = {
            margin: body.style.margin,
            padding: body.style.padding,
            overflowX: body.style.overflowX,
            boxSizing: body.style.boxSizing,
        };

        html.style.margin = "0";
        html.style.padding = "0";
        html.style.overflowX = "hidden";
        html.style.boxSizing = "border-box";

        body.style.margin = "0";
        body.style.padding = "0";
        body.style.overflowX = "hidden";
        body.style.boxSizing = "border-box";

        // --- Measurement (robust) ---
        const measure = (): number => {
            // Prefer element boxes (no scroll feedback), fall back to scroll/offset
            const rectH = Math.max(
                Math.ceil(html.getBoundingClientRect().height),
                Math.ceil(body.getBoundingClientRect().height)
            );

            const fallbackH = Math.max(
                html.scrollHeight,
                body.scrollHeight,
                html.offsetHeight,
                body.offsetHeight,
                html.clientHeight,
                body.clientHeight
            );

            const raw = Math.max(rectH, fallbackH) + EXTRA;

            // Snap up and clamp
            const snapped = Math.ceil(raw / SNAP) * SNAP;
            return Math.max(MIN_H, Math.min(MAX_H, snapped));
        };

        // --- Post with change guard ---
        let lastSent = 0;
        let rafId = 0;
        const safePost = (h: number) => {
            if (!window.parent) return;
            // Ignore tiny changes inside one snap bucket
            if (Math.abs(h - lastSent) < SNAP) return;
            lastSent = h;
            try {
                window.parent.postMessage({ type: "EMBED_HEIGHT", frameId, height: h }, "*");
            } catch {
                // ignore cross-origin or transient errors
            }
        };

        const schedulePost = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const h = measure();
                safePost(h);
            });
        };

        // --- Observers ---
        const ro = new ResizeObserver(() => schedulePost());
        ro.observe(html);
        ro.observe(body);

        const mo = new MutationObserver(() => schedulePost());
        mo.observe(body, { childList: true, subtree: true, attributes: true, characterData: true });

        // --- Other triggers ---
        const onVisibility = () => schedulePost();
        const onWindowLoad = () => schedulePost();
        const onImagesLoaded = () => schedulePost();

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("load", onWindowLoad);

        // Ensure we re-measure after late-loading images/fonts
        const imgs = Array.from(document.images ?? []);
        let imgLeft = imgs.length;
        if (imgLeft > 0) {
            imgs.forEach((img) => {
                if (img.complete) {
                    if (--imgLeft === 0) onImagesLoaded();
                } else {
                    const done = () => {
                        if (--imgLeft === 0) onImagesLoaded();
                    };
                    img.addEventListener("load", done, { once: true });
                    img.addEventListener("error", done, { once: true });
                }
            });
        }

        // Periodic keepalive
        const keepalive = window.setInterval(schedulePost, KEEPALIVE_MS);

        // Initial post
        schedulePost();

        // Cleanup
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.clearInterval(keepalive);
            ro.disconnect();
            mo.disconnect();
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("load", onWindowLoad);

            // restore original inline styles
            html.style.margin = origHtml.margin;
            html.style.padding = origHtml.padding;
            html.style.overflowX = origHtml.overflowX;
            html.style.boxSizing = origHtml.boxSizing;

            body.style.margin = origBody.margin;
            body.style.padding = origBody.padding;
            body.style.overflowX = origBody.overflowX;
            body.style.boxSizing = origBody.boxSizing;
        };
    }, []);

    return null;
}
