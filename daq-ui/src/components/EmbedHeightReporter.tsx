"use client";

import { useEffect } from "react";

/**
 * Reports the current document height to the parent window for iframe auto-resize.
 * - Snap-rounds to an 8px grid to avoid +/-1px oscillation.
 * - Clamps to sane range and rate-limits posts.
 * - Uses ResizeObserver + MutationObserver + images/fonts settle.
 *
 * Parent must listen for { type: "EMBED_HEIGHT", frameId, height }.
 * Child page should be opened with ?frameId=<id>.
 */
export default function EmbedHeightReporter() {
    useEffect(() => {
        // -------- Config ----------
        const SNAP = 8;                 // snap grid in px
        const EXTRA = 8;                // tiny cushion
        const MIN_H = 140;              // hard lower bound
        const MAX_H = 2800;             // hard upper bound (keeps mobile sane)
        const MIN_DELTA = 8;            // ignore sub-snap jitter
        const POST_THROTTLE_MS = 200;   // do not spam parent more often than this
        const KEEPALIVE_MS = 1500;      // periodic refresh in case observers miss

        // -------- frame identity ----
        const params = new URLSearchParams(window.location.search);
        const frameId = params.get("frameId") || undefined;

        // -------- defensive CSS to avoid phantom pixels/scrollbars ----
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

        // -------- measurement -------
        const measure = (): number => {
            // Use geometry first (no scroll feedback), fall back to scroll metrics
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

            // snap UP then clamp
            const snapped = Math.ceil(raw / SNAP) * SNAP;
            return Math.max(MIN_H, Math.min(MAX_H, snapped));
        };

        // -------- post w/ guards ----
        let lastSent = 0;
        let lastPostAt = 0;

        const tryPost = (h: number) => {
            if (!window.parent) return;
            const now = Date.now();
            if (now - lastPostAt < POST_THROTTLE_MS) return;

            if (Math.abs(h - lastSent) < MIN_DELTA) return; // ignore micro-jitter
            lastPostAt = now;
            lastSent = h;

            try {
                window.parent.postMessage({ type: "EMBED_HEIGHT", frameId, height: h }, "*");
            } catch {
                // ignore cross-origin issues
            }
        };

        let rafId = 0;
        const schedule = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => tryPost(measure()));
        };

        // -------- observers ----------
        const ro = new ResizeObserver(schedule);
        ro.observe(html);
        ro.observe(body);

        const mo = new MutationObserver(schedule);
        mo.observe(body, { childList: true, subtree: true, attributes: true, characterData: true });

        // images/fonts settle
        const images = Array.from(document.images || []);
        if (images.length) {
            let left = images.length;
            const done = () => { if (--left === 0) schedule(); };
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

        // signal ready + initial measurement
        try {
            window.parent?.postMessage({ type: "EMBED_READY", frameId }, "*");
        } catch {}
        schedule();

        // -------- cleanup -----------
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

            body.style.margin = origBody.margin;
            body.style.padding = origBody.padding;
            body.style.overflowX = origBody.overflowX;
            body.style.boxSizing = origBody.boxSizing;
        };
    }, []);

    return null;
}
