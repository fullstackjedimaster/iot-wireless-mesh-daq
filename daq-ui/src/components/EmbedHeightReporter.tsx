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

        if (!root) {
            console.warn(
                `[EmbedHeightReporter] Missing #${CONTENT_ROOT_ID}; height reporting is disabled.`,
            );

            return;
        }

        const frameId = getFrameId();

        let animationFrameId = 0;
        let lastHeight = 0;
        let disposed = false;

        const settleTimers =
            new Set<number>();

        const rootElement = root;

        function postMeasuredHeight(): void {
            if (disposed) {
                return;
            }

            window.cancelAnimationFrame(
                animationFrameId,
            );

            animationFrameId =
                window.requestAnimationFrame(
                    () => {
                        if (disposed) {
                            return;
                        }

                        const height =
                            measureContentHeight(
                                rootElement,
                            );

                        if (height <= 0) {
                            return;
                        }

                        if (
                            lastHeight > 0 &&
                            Math.abs(
                                height -
                                    lastHeight,
                            ) <
                                CHANGE_THRESHOLD
                        ) {
                            return;
                        }

                        lastHeight = height;

                        window.parent.postMessage(
                            {
                                type: "EMBED_HEIGHT",
                                frameId,
                                height,
                            },
                            "*",
                        );
                    },
                );
        }

        function scheduleSettledMeasurements(): void {
            for (
                const delay of
                SETTLE_DELAYS_MS
            ) {
                const timerId =
                    window.setTimeout(() => {
                        settleTimers.delete(
                            timerId,
                        );

                        postMeasuredHeight();
                    }, delay);

                settleTimers.add(timerId);
            }
        }

        /*
         * The outer DAQ iframe should not own a scrollbar.
         * Its parent resizes it to match #daq-embed-content.
         */
        document.documentElement.style.overflowX =
            "hidden";

        document.documentElement.style.overflowY =
            "hidden";

        document.body.style.overflowX =
            "hidden";

        document.body.style.overflowY =
            "hidden";

        scheduleSettledMeasurements();

        /*
         * ResizeObserver is the primary mechanism. It fires when
         * DockHost changes height after the RAG evaluation appears.
         */
        const resizeObserver =
            new ResizeObserver(() => {
                scheduleSettledMeasurements();
            });

        resizeObserver.observe(root);

        /*
         * MutationObserver catches content being inserted, removed,
         * or changed before ResizeObserver finishes reporting layout.
         */
        const mutationObserver =
            new MutationObserver(() => {
                scheduleSettledMeasurements();
            });

        mutationObserver.observe(root, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        const onLoad = (): void => {
            scheduleSettledMeasurements();
        };

        const onResize = (): void => {
            scheduleSettledMeasurements();
        };

        const onLayoutAnimationEnd =
            (): void => {
                scheduleSettledMeasurements();
            };

        window.addEventListener(
            "load",
            onLoad,
        );

        window.addEventListener(
            "resize",
            onResize,
        );

        document.addEventListener(
            "transitionend",
            onLayoutAnimationEnd,
            true,
        );

        document.addEventListener(
            "animationend",
            onLayoutAnimationEnd,
            true,
        );

        return () => {
            disposed = true;

            window.cancelAnimationFrame(
                animationFrameId,
            );

            for (
                const timerId of
                settleTimers
            ) {
                window.clearTimeout(
                    timerId,
                );
            }

            settleTimers.clear();

            resizeObserver.disconnect();
            mutationObserver.disconnect();

            window.removeEventListener(
                "load",
                onLoad,
            );

            window.removeEventListener(
                "resize",
                onResize,
            );

            document.removeEventListener(
                "transitionend",
                onLayoutAnimationEnd,
                true,
            );

            document.removeEventListener(
                "animationend",
                onLayoutAnimationEnd,
                true,
            );

        };
    }, []);

    return null;
}