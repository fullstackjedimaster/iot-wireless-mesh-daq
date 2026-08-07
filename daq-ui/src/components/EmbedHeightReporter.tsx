// ui-daq/src/components/EmbedHeightReporter.tsx
"use client";

import { useEffect } from "react";

const CONTENT_ROOT_ID = "daq-embed-content";

const MAX_HEIGHT = 5000;
const CHANGE_THRESHOLD = 2;

const SETTLE_DELAYS_MS = [
    0,
    50,
    150,
    350,
    750,
];

function getFrameId(): string {
    return (
        new URLSearchParams(
            window.location.search,
        ).get("frameId") || ""
    );
}

function clampHeight(height: number): number {
    return Math.min(
        MAX_HEIGHT,
        Math.max(1, Math.ceil(height)),
    );
}

function measureContentHeight(
    root: HTMLElement,
): number {
    const rootRect =
        root.getBoundingClientRect();

    /*
     * Measure the explicit DAQ content root only.
     *
     * Do not use:
     *   document.body.scrollHeight
     *   document.documentElement.scrollHeight
     *   document.scrollingElement.scrollHeight
     *
     * Those values may incorporate the iframe viewport and can
     * create a resize feedback loop on mobile.
     */
    const rawHeight = Math.max(
        rootRect.height,
        root.offsetHeight,
    );

    return clampHeight(rawHeight);
}

export default function EmbedHeightReporter() {
    useEffect(() => {
        const root =
            document.getElementById(
                CONTENT_ROOT_ID,
            );
    })
}