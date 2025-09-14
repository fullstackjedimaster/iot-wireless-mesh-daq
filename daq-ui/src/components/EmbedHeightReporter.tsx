// /daq-ui/src/components/EmbedHeightReporter.tsx
"use client";

import { useEffect } from "react";

/**
 * Reports the current document height to the parent window for iframe auto-resize.
 * Key stability tricks:
 * - Prefer geometry (getBoundingClientRect) over scroll metrics.
 * - Discard obviously-wrong "fallback" heights (runaway min-heights, bg art, etc).
 * - Snap to an 8px grid + small cushion to kill +/-1px thrash.
 * - Device-aware hard cap to avoid "endless" mobile scroll.
 * - Gentle throttling and periodic keepalive.
 *
 * Parent must listen for: { type: "EMBED_HEIGHT", frameId, height }.
 * Child page should be opened with: ?frameId=<id>.
 */
export default function EmbedHeightReporter() {
    useEffect(() => {
        // ---------- Tunables ----------
        const SNAP = 8;               // snap grid in px
        const EXTRA = 8;              // tiny cushion
        const MIN_H = 140;            // hard lower bound
        const MOBILE_MAX_H = 1800;    // mobile hard cap (prevents endless scroll feeling)
        const DESKTOP_MAX_H = 2400;   // desktop hard cap
        const MIN_DELTA = 8;          // ignore sub-snap jitter
        const POST_THROTTLE_MS = 160; // avoid spam
        const KEEPALIVE_MS = 1500;    // periodic refresh

        const isMobile =
            typeof navigator !== "undefined" &&
            /Android|iPhone|iPad|iPod|Mobile|Pixel/i.test(navigator.userAgent);

        const MAX_H = isMobile ? MOBILE_MAX_H : DESKTOP_MAX_H;

        // ---------- frame identity ----------
        const params = new URLSearchParams(window.location.search);
        const frameId = params.get("frameId") || undefined;

        // ---------- defensive CSS (horizontal only) ----------
        const html = document.documentElement;
        const body = document.body;

        const origHtml = {
            margin: html.style.margin,
            padding: html.style.padding,
            overflowX: html.style.overflowX,
            boxSizing: html.style.boxSizing,
            maxWidth: html.style.maxWidth,
        };
        const origBody = {
            margin: body.style.margin,
            padding: body.style.padding,
            overflowX: body.style.overflowX,
            boxSizing: body.style.boxSizing,
            maxWidth: body.style.maxWidth,
        };

        html.style.margin = "0";
        html.style.padding = "0";
        html.style.overflowX = "hidden";
        html.style.boxSizing = "border-box";
        html.style.maxWidth = "100%";

        body.style.margin = "0";
        body.style.padding = "0";
        body.style.overflowX = "hidden";
        body.style.boxSizing = "border-box";
        body.style.maxWidth = "100%";

        // ---------- measurement ----------
        /**
         * Prefer geometry from the *scrolling element* or body/html.
         * Only use scroll-based metrics if geometry is clearly wrong (e.g., < MIN_H),
         * and even then, discard fallbacks that look like runaways.
         */
        const measure = (): number => {
            const se = document.scrollingElement || document.documentElement;

            const geomH = Math.max(
                Math.ceil(se.getBoundingClientRect().height),
                Math.ceil(html.getBoundingClientRect().height),
                Math.ceil(body.getBoundingClientRect().height)
            );

            // If geometry gives us a plausible value, take it.
            let raw = geomH;

            if (!Number.isFinite(raw) || raw < MIN_H) {
                // Geometry failed → consider scroll metrics (last resort)
                const fallback = Math.max(
                    se ? se.scrollHeight : 0,
                    html.scrollHeight,
                    body.scrollHeight,
                    html.offsetHeight,
                    body.offsetHeight,
                    html.clientHeight,
                    body.clientHeight
                );

                // Anomaly guard: if fallback is wildly larger than geometry, prefer geometry.
                // (Runaway min-heights, backgrounds, offscreen pseudo-elements, etc.)
                const safeFallback =
                    Number.isFinite(fallback) && fallback > 0 && fallback < 3_200
                        ? fallback
                        : geomH;

                raw = Math.max(geomH, safeFallback);
            }

            // Small cushion + snap to grid, then clamp.
            const snapped = Math.ceil((raw + EXTRA) / SNAP) * SNAP;
            return Math.max(MIN_H, Math.min(MAX_H, snapped));
        };

        // ---------- post w/ guards ----------
        let lastSent = 0;
        let lastPostAt = 0;
        let rafId = 0;

        const tryPost = (h: number) => {
            if (!window.parent) return;
            const now = Date.now();
            if (now - lastPostAt < POST_THROTTLE_MS) return;
            if (Math.abs(h - lastSent) < MIN_DELTA) return;

            lastPostAt = now;
            lastSent = h;

            try {
                window.parent.postMessage({ type: "EMBED_HEIGHT", frameId, height: h }, "*");
            } catch {
                // cross-origin: intentionally ignored
            }
        };

        const schedule = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => tryPost(measure()));
        };

        // ---------- observers ----------
        const ro = new ResizeObserver(schedule);
        ro.observe(html);
        ro.observe(body);

        const mo = new MutationObserver(schedule);
        mo.observe(body, { childList: true, subtree: true, attributes: true, characterData: true });

        // images & fonts
        const images = Array.from(document.images || []);
        if (images.length) {
            let left = images.length;
            const done = () => {
                left -= 1;
                if (left <= 0) schedule();
            };
            images.forEach((img) => {
                if (img.complete) done();
                else {
                    img.addEventListener("load", done, { once: true });
                    img.addEventListener("error", done, { once: true });
                }
            });
        }

        document.addEventListener("visibilitychange", schedule);
        window.addEventListener("load", schedule);

        // keepalive (cheap)
        const keepalive = window.setInterval(schedule, KEEPALIVE_MS);

        // initial ready ping + measure
        try {
            window.parent?.postMessage({ type: "EMBED_READY", frameId }, "*");
        } catch {}
        schedule();

        // ---------- cleanup ----------
        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            window.clearInterval(keepalive);
            ro.disconnect();
            mo.disconnect();
            document.removeEventListener("visibilitychange", schedule);
            window.removeEventListener("load", schedule);

            html.style.margin = origHtml.margin;
            html.style.padding = origHtml.padding;
            html.style.overflowX = origHtml.overflowX;
            html.style.boxSizing = origHtml.boxSizing;
            html.style.maxWidth = origHtml.maxWidth;

            body.style.margin = origBody.margin;
            body.style.padding = origBody.padding;
            body.style.overflowX = origBody.overflowX;
            body.style.boxSizing = origBody.boxSizing;
            body.style.maxWidth = origBody.maxWidth;
        };
    }, []);

    return null;
}
