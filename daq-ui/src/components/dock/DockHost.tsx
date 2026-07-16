"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import type { Attrs } from "@/lib/dock/selection";
import { settings } from "@/lib/settings";

const RAG_API_BASE = settings.RAG_API_BASE;
const DOCK_ORIGIN = settings.DOCK_ORIGIN;
const FRAME_ID =
    settings.DOCK_FRAME_ID ?? "daq-dock";

const DEFAULT_DOCK_HEIGHT = 600;
const MIN_DOCK_HEIGHT = 240;
const MAX_DOCK_HEIGHT = 5000;
const DOCK_HEIGHT_CHANGE_THRESHOLD = 8;

const HOST_APP_ID =
    "iot-wireless-mesh-daq";

const HOST_DEFAULT_DENSITY =
    "compact";

type RagSessionMessage = {
    type: "RAG_SESSION";
    token: string;
    exp?: number;
};

type TargetSelectedMessage = {
    type: "TARGET_SELECTED";
    id: string;
    subject_id: string;
    attrs?: Attrs;
    source?: string;
};

type HostCssVars = Record<string, string>;

type HostThemeMetadata = {
    app: string;
    mode?: string;
    density?: string;
    theme?: string;
};

type HostCssVarsMessage = {
    type: "HOST_CSS_VARS";
    frameId?: string;
    vars: HostCssVars;
    host: HostThemeMetadata;
};

type RagDockConnectMessage = {
    type: "RAG_DOCK_CONNECT";
    ragClientId: string;
    dockUrl: string;
    label?: string;
    hostUrl?: string;
};

type RagDockDisconnectMessage = {
    type: "RAG_DOCK_DISCONNECT";
    ragClientId?: string;
};

type RagDockReadyMessage = {
    type: "RAG_DOCK_READY";
    frameId?: string;
};

type RagDockResizeMessage = {
    type: "RAG_DOCK_RESIZE";
    frameId?: string;
    height: number;
};

type RagClientRow = {
    id: string;
    name: string;
    host_url: string;
};

type PanelSelectedDetail = {
    mac?: string;
    id?: string;
    attrs?: Attrs | null;
    source?: string;
};

function safeTrimSlash(
    value: string,
): string {
    return value.replace(/\/+$/, "");
}

function isObject(
    value: unknown,
): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function getOrigin(
    value: string,
): string {
    try {
        return new URL(value).origin;
    } catch {
        return "";
    }
}

function getInitialRagClientIdFromUrl(): string | null {
    if (typeof window === "undefined") {
        return null;
    }

    const params = new URLSearchParams(
        window.location.search,
    );

    const ragClientId =
        params.get("ragClientId");

    return ragClientId?.trim() || null;
}

function parseConnectMessage(
    data: unknown,
): RagDockConnectMessage | null {
    if (
        !isObject(data) ||
        data.type !== "RAG_DOCK_CONNECT"
    ) {
        return null;
    }

    const ragClientId =
        data.ragClientId;

    const dockUrl =
        data.dockUrl;

    if (
        typeof ragClientId !== "string" ||
        !ragClientId.trim()
    ) {
        return null;
    }

    if (
        typeof dockUrl !== "string" ||
        !dockUrl.trim()
    ) {
        return null;
    }

    return {
        type: "RAG_DOCK_CONNECT",
        ragClientId:
            ragClientId.trim(),
        dockUrl:
            dockUrl.trim(),
        label:
            typeof data.label === "string"
                ? data.label
                : undefined,
        hostUrl:
            typeof data.hostUrl === "string"
                ? data.hostUrl
                : undefined,
    };
}

function parseDisconnectMessage(
    data: unknown,
): RagDockDisconnectMessage | null {
    if (
        !isObject(data) ||
        data.type !== "RAG_DOCK_DISCONNECT"
    ) {
        return null;
    }

    const rawRagClientId =
        data.ragClientId;

    return {
        type: "RAG_DOCK_DISCONNECT",
        ragClientId:
            typeof rawRagClientId ===
                "string" &&
            rawRagClientId.trim()
                ? rawRagClientId.trim()
                : undefined,
    };
}

function parseReadyMessage(
    data: unknown,
): RagDockReadyMessage | null {
    if (
        !isObject(data) ||
        data.type !== "RAG_DOCK_READY"
    ) {
        return null;
    }

    return {
        type: "RAG_DOCK_READY",
        frameId:
            typeof data.frameId === "string"
                ? data.frameId
                : undefined,
    };
}

function parseResizeMessage(
    data: unknown,
): RagDockResizeMessage | null {
    if (
        !isObject(data) ||
        data.type !== "RAG_DOCK_RESIZE"
    ) {
        return null;
    }

    if (
        typeof data.height !== "number" ||
        !Number.isFinite(data.height)
    ) {
        return null;
    }

    return {
        type: "RAG_DOCK_RESIZE",
        frameId:
            typeof data.frameId === "string"
                ? data.frameId
                : undefined,
        height:
            data.height,
    };
}

function clampDockHeight(
    height: number,
): number {
    return Math.min(
        MAX_DOCK_HEIGHT,
        Math.max(
            MIN_DOCK_HEIGHT,
            Math.ceil(height),
        ),
    );
}

function collectCssCustomProperties(
    element: Element | null,
): HostCssVars {
    if (!element) {
        return {};
    }

    const styles =
        window.getComputedStyle(element);

    const vars: HostCssVars = {};

    for (
        let index = 0;
        index < styles.length;
        index += 1
    ) {
        const propertyName =
            styles.item(index);

        if (
            !propertyName.startsWith("--")
        ) {
            continue;
        }

        const value =
            styles
                .getPropertyValue(
                    propertyName,
                )
                .trim();

        if (!value) {
            continue;
        }

        vars[propertyName] =
            value;
    }

    return vars;
}

function mergeCssCustomProperties(
    ...sources: Array<
        Element | null | undefined
    >
): HostCssVars {
    const merged: HostCssVars = {};

    for (const source of sources) {
        Object.assign(
            merged,
            collectCssCustomProperties(
                source ?? null,
            ),
        );
    }

    return merged;
}

function readHostThemeMetadata(
    hostElement?: Element | null,
): HostThemeMetadata {
    const html =
        document.documentElement;

    const body =
        document.body;

    const theme =
        hostElement?.getAttribute(
            "data-theme",
        ) ||
        body?.getAttribute(
            "data-theme",
        ) ||
        html.getAttribute(
            "data-theme",
        ) ||
        (
            html.classList.contains(
                "dark",
            )
                ? "dark"
                : html.classList.contains(
                      "light",
                  )
                  ? "light"
                  : undefined
        );

    const mode =
        hostElement?.getAttribute(
            "data-mode",
        ) ||
        body?.getAttribute(
            "data-mode",
        ) ||
        html.getAttribute(
            "data-mode",
        ) ||
        undefined;

    const density =
        hostElement?.getAttribute(
            "data-density",
        ) ||
        body?.getAttribute(
            "data-density",
        ) ||
        html.getAttribute(
            "data-density",
        ) ||
        HOST_DEFAULT_DENSITY;

    return {
        app: HOST_APP_ID,
        mode,
        density,
        theme,
    };
}

function normalizeDockUrl(
    rawDockUrl: string,
    ragClientId: string,
): URL {
    const url =
        new URL(rawDockUrl);

    url.searchParams.set(
        "ragClientId",
        ragClientId,
    );

    url.searchParams.set(
        "frameId",
        FRAME_ID,
    );

    return url;
}

export default function DockHost() {
    const iframeRef =
        useRef<HTMLIFrameElement | null>(
            null,
        );

    const themePublishFrameRef =
        useRef<number | null>(null);

    const [attached, setAttached] =
        useState(false);

    const [ragClientId, setRagClientId] =
        useState<string | null>(null);

    const [dockUrl, setDockUrl] =
        useState<string | null>(null);

    const [ragClient, setRagClient] =
        useState<RagClientRow | null>(
            null,
        );

    const [sessionToken, setSessionToken] =
        useState("");

    const [sessionExp, setSessionExp] =
        useState<number | null>(null);

    const [dockReady, setDockReady] =
        useState(false);

    const [iframeHeight, setIframeHeight] =
        useState(DEFAULT_DOCK_HEIGHT);

    const [lastError, setLastError] =
        useState("");

    const dockBaseUrl = useMemo(() => {
        return DOCK_ORIGIN
            ? safeTrimSlash(DOCK_ORIGIN)
            : "";
    }, []);

    const expectedDockOrigin =
        useMemo(() => {
            return dockBaseUrl
                ? getOrigin(dockBaseUrl)
                : "";
        }, [dockBaseUrl]);

    const ragBase = useMemo(() => {
        return RAG_API_BASE
            ? safeTrimSlash(
                  RAG_API_BASE,
              )
            : "";
    }, []);

    const configured = Boolean(
        ragBase &&
            dockBaseUrl &&
            expectedDockOrigin,
    );

    const publishHostCssVars =
        useCallback((): void => {
            const iframe =
                iframeRef.current;

            const dockWindow =
                iframe?.contentWindow;

            if (
                !iframe ||
                !dockWindow ||
                !expectedDockOrigin
            ) {
                return;
            }

            const hostElement =
                iframe.parentElement;

            /*
             * Later sources override earlier sources.
             *
             * This means:
             *   :root variables
             *       ↓
             *   body-level overrides
             *       ↓
             *   .rag-dock-host overrides
             *
             * The dock therefore receives the variables that are
             * actually effective at its mounting location.
             */
            const vars =
                mergeCssCustomProperties(
                    document.documentElement,
                    document.body,
                    hostElement,
                );

            const message:
                HostCssVarsMessage = {
                    type:
                        "HOST_CSS_VARS",
                    frameId:
                        FRAME_ID,
                    vars,
                    host:
                        readHostThemeMetadata(
                            hostElement,
                        ),
                };

            dockWindow.postMessage(
                message,
                expectedDockOrigin,
            );
        }, [
            expectedDockOrigin,
        ]);

    const scheduleHostCssVarsPublish =
        useCallback((): void => {
            if (
                themePublishFrameRef.current !==
                null
            ) {
                window.cancelAnimationFrame(
                    themePublishFrameRef.current,
                );
            }

            themePublishFrameRef.current =
                window.requestAnimationFrame(
                    () => {
                        themePublishFrameRef.current =
                            null;

                        publishHostCssVars();
                    },
                );
        }, [
            publishHostCssVars,
        ]);

    function resetDockRuntime(): void {
        setSessionToken("");
        setSessionExp(null);
        setDockReady(false);

        setIframeHeight(
            DEFAULT_DOCK_HEIGHT,
        );

        setRagClient(null);
    }

    useEffect(() => {
        if (!configured) {
            return;
        }

        const initialRagClientId =
            getInitialRagClientIdFromUrl();

        if (!initialRagClientId) {
            return;
        }

        const url =
            new URL(
                "/dock",
                dockBaseUrl,
            );

        url.searchParams.set(
            "ragClientId",
            initialRagClientId,
        );

        url.searchParams.set(
            "frameId",
            FRAME_ID,
        );

        setDockReady(false);

        setIframeHeight(
            DEFAULT_DOCK_HEIGHT,
        );

        setAttached(true);

        setRagClientId(
            initialRagClientId,
        );

        setDockUrl(
            url.toString(),
        );
    }, [
        configured,
        dockBaseUrl,
    ]);

    useEffect(() => {
        if (!configured) {
            return;
        }

        function onMessage(
            event: MessageEvent<unknown>,
        ): void {
            const iframe =
                iframeRef.current;

            const readyMessage =
                parseReadyMessage(
                    event.data,
                );

            if (readyMessage) {
                if (
                    !iframe ||
                    event.source !==
                        iframe.contentWindow
                ) {
                    return;
                }

                if (
                    event.origin !==
                    expectedDockOrigin
                ) {
                    return;
                }

                if (
                    readyMessage.frameId &&
                    readyMessage.frameId !==
                        FRAME_ID
                ) {
                    return;
                }

                setDockReady(true);

                /*
                 * Publish immediately during the handshake rather
                 * than waiting for the dockReady state update.
                 */
                scheduleHostCssVarsPublish();
                return;
            }

            const resizeMessage =
                parseResizeMessage(
                    event.data,
                );

            if (resizeMessage) {
                if (
                    !iframe ||
                    event.source !==
                        iframe.contentWindow
                ) {
                    return;
                }

                if (
                    event.origin !==
                    expectedDockOrigin
                ) {
                    return;
                }

                if (
                    resizeMessage.frameId &&
                    resizeMessage.frameId !==
                        FRAME_ID
                ) {
                    return;
                }

                const nextHeight =
                    clampDockHeight(
                        resizeMessage.height,
                    );

                setIframeHeight(
                    (currentHeight) => {
                        const difference =
                            Math.abs(
                                currentHeight -
                                    nextHeight,
                            );

                        return difference >=
                            DOCK_HEIGHT_CHANGE_THRESHOLD
                            ? nextHeight
                            : currentHeight;
                    },
                );

                return;
            }

            /*
             * Connect/disconnect commands come from the host,
             * not from the nested RAG iframe.
             */
            if (
                event.source !==
                    window.parent &&
                event.source !== window
            ) {
                return;
            }

            const connectMessage =
                parseConnectMessage(
                    event.data,
                );

            if (connectMessage) {
                let resolvedDockUrl: URL;

                try {
                    resolvedDockUrl =
                        normalizeDockUrl(
                            connectMessage.dockUrl,
                            connectMessage.ragClientId,
                        );
                } catch {
                    setLastError(
                        "RAG dock connection supplied an invalid dock URL.",
                    );

                    return;
                }

                if (
                    resolvedDockUrl.origin !==
                    expectedDockOrigin
                ) {
                    setLastError(
                        `Rejected dock URL from unexpected origin: ${resolvedDockUrl.origin}`,
                    );

                    return;
                }

                setLastError("");
                resetDockRuntime();

                setRagClientId(
                    connectMessage.ragClientId,
                );

                setDockUrl(
                    resolvedDockUrl.toString(),
                );

                setAttached(true);
                return;
            }

            const disconnectMessage =
                parseDisconnectMessage(
                    event.data,
                );

            if (!disconnectMessage) {
                return;
            }

            if (
                disconnectMessage.ragClientId &&
                disconnectMessage.ragClientId !==
                    ragClientId
            ) {
                return;
            }

            setLastError("");
            resetDockRuntime();

            setAttached(false);
            setDockUrl(null);
            setRagClientId(null);
        }

        window.addEventListener(
            "message",
            onMessage,
        );

        return () => {
            window.removeEventListener(
                "message",
                onMessage,
            );
        };
    }, [
        configured,
        expectedDockOrigin,
        ragClientId,
        scheduleHostCssVarsPublish,
    ]);

    useEffect(() => {
        if (
            !configured ||
            !attached ||
            !ragClientId
        ) {
            return;
        }

        const clientId =
            ragClientId;

        const controller =
            new AbortController();

        async function resolveClientById(): Promise<void> {
            try {
                setLastError("");

                const response =
                    await fetch(
                        `${ragBase}/api/rag-clients/${encodeURIComponent(
                            clientId,
                        )}`,
                        {
                            cache:
                                "no-store",
                            signal:
                                controller.signal,
                        },
                    );

                if (!response.ok) {
                    const responseText =
                        await response
                            .text()
                            .catch(
                                () => "",
                            );

                    setRagClient(null);

                    setLastError(
                        `resolveClient: ${response.status} ${response.statusText}${
                            responseText
                                ? ` — ${responseText}`
                                : ""
                        }`,
                    );

                    return;
                }

                const client =
                    (await response.json()) as RagClientRow;

                if (!client?.id) {
                    setRagClient(null);

                    setLastError(
                        `resolveClient: missing id for rag_client ${clientId}`,
                    );

                    return;
                }

                if (
                    client.id !==
                    clientId
                ) {
                    setRagClient(null);

                    setLastError(
                        `resolveClient: requested ${clientId}, received ${client.id}`,
                    );

                    return;
                }

                setRagClient(client);
            } catch (error: unknown) {
                if (
                    controller.signal.aborted
                ) {
                    return;
                }

                setRagClient(null);

                setLastError(
                    error instanceof Error
                        ? error.message
                        : String(error),
                );
            }
        }

        void resolveClientById();

        return () => {
            controller.abort();
        };
    }, [
        configured,
        attached,
        ragClientId,
        ragBase,
    ]);

    useEffect(() => {
        if (
            !configured ||
            !attached ||
            !ragClientId ||
            !ragClient
        ) {
            return;
        }

        /*
         * Portfolio lock is currently disabled for this
         * internal development path.
         */
        setSessionToken(
            "debug-disabled",
        );

        setSessionExp(null);
    }, [
        configured,
        attached,
        ragClientId,
        ragClient,
    ]);

    useEffect(() => {
        if (
            !configured ||
            !attached ||
            !dockReady ||
            !sessionToken
        ) {
            return;
        }

        const dockWindow =
            iframeRef.current
                ?.contentWindow;

        if (!dockWindow) {
            return;
        }

        const message:
            RagSessionMessage = {
                type:
                    "RAG_SESSION",
                token:
                    sessionToken,
            };

        if (
            typeof sessionExp ===
            "number"
        ) {
            message.exp =
                sessionExp;
        }

        dockWindow.postMessage(
            message,
            expectedDockOrigin,
        );
    }, [
        configured,
        attached,
        dockReady,
        sessionToken,
        sessionExp,
        expectedDockOrigin,
    ]);

    useEffect(() => {
        if (
            !configured ||
            !attached ||
            !dockReady
        ) {
            return;
        }

        scheduleHostCssVarsPublish();
    }, [
        configured,
        attached,
        dockReady,
        scheduleHostCssVarsPublish,
    ]);

    useEffect(() => {
        if (
            !configured ||
            !attached
        ) {
            return;
        }

        const iframe =
            iframeRef.current;

        const hostElement =
            iframe?.parentElement ??
            null;

        const observedElements: HTMLElement[] = [
            document.documentElement,
            document.body,
            hostElement,
        ].filter(
            (
                element,
            ): element is HTMLElement =>
                element instanceof HTMLElement,
        );

        const observer =
            new MutationObserver(
                () => {
                    if (!dockReady) {
                        return;
                    }

                    scheduleHostCssVarsPublish();
                },
            );

        for (
            const element of
            observedElements
        ) {
            observer.observe(
                element,
                {
                    attributes: true,
                    attributeFilter: [
                        "class",
                        "style",
                        "data-theme",
                        "data-mode",
                        "data-density",
                    ],
                },
            );
        }

        const darkModeQuery =
            window.matchMedia(
                "(prefers-color-scheme: dark)",
            );

        const onColorSchemeChange =
            (): void => {
                if (!dockReady) {
                    return;
                }

                scheduleHostCssVarsPublish();
            };

        darkModeQuery.addEventListener(
            "change",
            onColorSchemeChange,
        );

        const onWindowResize =
            (): void => {
                if (!dockReady) {
                    return;
                }

                scheduleHostCssVarsPublish();
            };

        window.addEventListener(
            "resize",
            onWindowResize,
        );

        return () => {
            observer.disconnect();

            darkModeQuery.removeEventListener(
                "change",
                onColorSchemeChange,
            );

            window.removeEventListener(
                "resize",
                onWindowResize,
            );
        };
    }, [
        configured,
        attached,
        dockReady,
        scheduleHostCssVarsPublish,
    ]);

    useEffect(() => {
        return () => {
            if (
                themePublishFrameRef.current !==
                null
            ) {
                window.cancelAnimationFrame(
                    themePublishFrameRef.current,
                );

                themePublishFrameRef.current =
                    null;
            }
        };
    }, []);

    useEffect(() => {
        if (
            !configured ||
            !attached
        ) {
            return;
        }

        function onPanelSelected(
            event: Event,
        ): void {
            const customEvent =
                event as CustomEvent<PanelSelectedDetail>;

            const id =
                customEvent.detail?.id ??
                customEvent.detail?.mac;

            if (!id) {
                return;
            }

            const message:
                TargetSelectedMessage = {
                    type:
                        "TARGET_SELECTED",
                    id:
                        String(id),
                    subject_id:
                        String(id),
                    attrs:
                        customEvent.detail
                            ?.attrs ??
                        undefined,
                    source:
                        customEvent.detail
                            ?.source ??
                        "daq-ui",
                };

            /*
             * Target selections wait until the real RAG document
             * has announced readiness.
             */
            if (!dockReady) {
                return;
            }

            iframeRef.current
                ?.contentWindow
                ?.postMessage(
                    message,
                    expectedDockOrigin,
                );
        }

        window.addEventListener(
            "panel-selected",
            onPanelSelected as EventListener,
        );

        return () => {
            window.removeEventListener(
                "panel-selected",
                onPanelSelected as EventListener,
            );
        };
    }, [
        configured,
        attached,
        dockReady,
        expectedDockOrigin,
    ]);

    const iframeSrc = useMemo(() => {
        if (dockUrl) {
            try {
                const normalized =
                    new URL(dockUrl);

                if (ragClientId) {
                    normalized.searchParams.set(
                        "ragClientId",
                        ragClientId,
                    );
                }

                normalized.searchParams.set(
                    "frameId",
                    FRAME_ID,
                );

                return normalized.toString();
            } catch {
                return dockUrl;
            }
        }

        const base =
            `${dockBaseUrl}/dock`;

        const clientId =
            ragClientId;

        const url =
            new URL(base);

        if (clientId) {
            url.searchParams.set(
                "ragClientId",
                clientId,
            );
        }

        /*
         * Allows the nested dock to identify its host frame
         * in readiness, theme, and resize messages.
         */
        url.searchParams.set(
            "frameId",
            FRAME_ID,
        );

        return url.toString();
    }, [
        dockBaseUrl,
        dockUrl,
        ragClientId,
    ]);

    if (!configured) {
        return (
            <div className="text-xs text-red-700">
                RAG dock configuration is
                incomplete.
            </div>
        );
    }

    if (!attached) {
        return null;
    }

    return (
        <div
            className="rag-dock-host"
            data-app={HOST_APP_ID}
            data-density={
                HOST_DEFAULT_DENSITY
            }
            style={{
                width: "100%",
                height: "auto",
                minHeight: 0,
                maxHeight: "none",
                overflow: "hidden",
            }}
        >
            {lastError ? (
                <div
                    className="mb-2 text-xs text-red-700"
                    role="alert"
                >
                    {lastError}
                </div>
            ) : null}

            <iframe
                key={
                    ragClientId ??
                    "no-rag-client"
                }
                ref={iframeRef}
                id={FRAME_ID}
                src={iframeSrc}
                title="AI explanation dock"
                className="block w-full border-0"
                style={{
                    display: "block",
                    width: "100%",
                    height:
                        `${iframeHeight}px`,
                    minHeight: 0,
                    maxHeight: "none",
                    border: 0,
                    overflow: "hidden",
                    background:
                        "transparent",
                }}
                onLoad={() => {
                    /*
                     * A navigation invalidates the previous handshake.
                     * The newly loaded RAG document must announce
                     * RAG_DOCK_READY again.
                     */
                    setDockReady(false);
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
        </div>
    );
}