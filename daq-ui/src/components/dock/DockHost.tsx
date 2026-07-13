"use client";

import {
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
const DOCK_HEIGHT_CHANGE_THRESHOLD = 4;
const DOCK_HEIGHT_PADDING = 4;

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

type RagDockResizeMessage = {
    type: "RAG_DOCK_RESIZE";
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

function safeTrimSlash(value: string): string {
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

function getOrigin(value: string): string {
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
        params.get("ragClientId") ??
        params.get("ragclientid");

    return ragClientId?.trim() || null;
}

function parseConnectMessage(
    data: unknown,
): RagDockConnectMessage | null {
    if (!isObject(data)) {
        return null;
    }

    if (data.type !== "RAG_DOCK_CONNECT") {
        return null;
    }

    const ragClientId = data.ragClientId;
    const dockUrl = data.dockUrl;

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
        ragClientId: ragClientId.trim(),
        dockUrl: dockUrl.trim(),
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
    if (!isObject(data)) {
        return null;
    }

    if (data.type !== "RAG_DOCK_DISCONNECT") {
        return null;
    }

    const rawRagClientId = data.ragClientId;

    return {
        type: "RAG_DOCK_DISCONNECT",
        ragClientId:
            typeof rawRagClientId === "string" &&
            rawRagClientId.trim()
                ? rawRagClientId.trim()
                : undefined,
    };
}

function parseResizeMessage(
    data: unknown,
): RagDockResizeMessage | null {
    if (!isObject(data)) {
        return null;
    }

    if (data.type !== "RAG_DOCK_RESIZE") {
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
        height: data.height,
    };
}

function clampDockHeight(height: number): number {
    const paddedHeight = Math.ceil(
        height + DOCK_HEIGHT_PADDING,
    );

    return Math.min(
        MAX_DOCK_HEIGHT,
        Math.max(
            MIN_DOCK_HEIGHT,
            paddedHeight,
        ),
    );
}

export default function DockHost() {
    const iframeRef =
        useRef<HTMLIFrameElement | null>(null);

    const [attached, setAttached] =
        useState(false);

    const [ragClientId, setRagClientId] =
        useState<string | null>(null);

    const [dockUrl, setDockUrl] =
        useState<string | null>(null);

    const [ragClient, setRagClient] =
        useState<RagClientRow | null>(null);

    const [sessionToken, setSessionToken] =
        useState("");

    const [sessionExp, setSessionExp] =
        useState<number | null>(null);

    const [iframeLoaded, setIframeLoaded] =
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

    const expectedDockOrigin = useMemo(() => {
        return dockBaseUrl
            ? getOrigin(dockBaseUrl)
            : "";
    }, [dockBaseUrl]);

    const ragBase = useMemo(() => {
        return RAG_API_BASE
            ? safeTrimSlash(RAG_API_BASE)
            : "";
    }, []);

    const configured = Boolean(
        ragBase &&
        dockBaseUrl &&
        expectedDockOrigin,
    );

    function resetDockRuntime(): void {
        setSessionToken("");
        setSessionExp(null);
        setIframeLoaded(false);
        setIframeHeight(DEFAULT_DOCK_HEIGHT);
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

        const url = new URL(
            "/dock",
            dockBaseUrl,
        );

        url.searchParams.set(
            "ragClientId",
            initialRagClientId,
        );

        setIframeLoaded(false);
        setIframeHeight(DEFAULT_DOCK_HEIGHT);
        setAttached(true);
        setRagClientId(initialRagClientId);
        setDockUrl(url.toString());
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
            const resizeMessage =
                parseResizeMessage(event.data);

            if (resizeMessage) {
                const iframe = iframeRef.current;

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
             * Connect and disconnect commands are expected
             * from the outer host, not from the dock iframe.
             */
            if (
                event.source !== window.parent &&
                event.source !== window
            ) {
                return;
            }

            const connectMessage =
                parseConnectMessage(event.data);

            if (connectMessage) {
                let resolvedDockUrl: URL;

                try {
                    resolvedDockUrl = new URL(
                        connectMessage.dockUrl,
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
    ]);

    useEffect(() => {
        if (
            !configured ||
            !attached ||
            !ragClientId
        ) {
            return;
        }

        /*
         * Capture the narrowed value before entering the
         * nested async function. This keeps clientId typed
         * as string rather than string | null.
         */
        const clientId = ragClientId;
        const controller =
            new AbortController();

        async function resolveClientById(): Promise<void> {
            try {
                setLastError("");

                const response = await fetch(
                    `${ragBase}/api/rag-clients/${encodeURIComponent(
                        clientId,
                    )}`,
                    {
                        cache: "no-store",
                        signal:
                            controller.signal,
                    },
                );

                if (!response.ok) {
                    const responseText =
                        await response
                            .text()
                            .catch(() => "");

                    throw new Error(
                        `resolveClient: ${
                            response.status
                        } ${
                            response.statusText
                        }${
                            responseText
                                ? ` — ${responseText}`
                                : ""
                        }`,
                    );
                }

                const client =
                    (await response.json()) as RagClientRow;

                if (!client?.id) {
                    throw new Error(
                        `resolveClient: missing id for rag_client ${clientId}`,
                    );
                }

                if (client.id !== clientId) {
                    throw new Error(
                        `resolveClient: requested ${clientId}, received ${client.id}`,
                    );
                }

                setRagClient(client);
            } catch (caughtError) {
                if (
                    controller.signal.aborted
                ) {
                    return;
                }

                setRagClient(null);

                setLastError(
                    caughtError instanceof Error
                        ? caughtError.message
                        : String(caughtError),
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
        setSessionToken("debug-disabled");
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
            !iframeLoaded ||
            !sessionToken
        ) {
            return;
        }

        const dockWindow =
            iframeRef.current?.contentWindow;

        if (!dockWindow) {
            return;
        }

        const message: RagSessionMessage = {
            type: "RAG_SESSION",
            token: sessionToken,
        };

        if (
            typeof sessionExp === "number"
        ) {
            message.exp = sessionExp;
        }

        dockWindow.postMessage(
            message,
            expectedDockOrigin,
        );
    }, [
        configured,
        attached,
        iframeLoaded,
        sessionToken,
        sessionExp,
        expectedDockOrigin,
    ]);

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

            const message: TargetSelectedMessage = {
                type: "TARGET_SELECTED",
                id: String(id),
                subject_id: String(id),
                attrs:
                    customEvent.detail?.attrs ??
                    undefined,
                source:
                    customEvent.detail?.source ??
                    "daq-ui",
            };

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
        expectedDockOrigin,
    ]);

    const iframeSrc = useMemo(() => {
        if (dockUrl) {
            return dockUrl;
        }

        const base = `${dockBaseUrl}/dock`;
        const clientId = ragClientId;

        if (!clientId) {
            return base;
        }

        const url = new URL(base);

        /*
         * URLSearchParams performs the required encoding.
         * Do not call encodeURIComponent here.
         */
        url.searchParams.set(
            "ragClientId",
            clientId,
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
                RAG dock configuration is incomplete.
            </div>
        );
    }

    if (!attached) {
        return null;
    }

    return (
        <div
            className="rag-dock-host"
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
                scrolling="no"
                className="block w-full border-0"
                style={{
                    display: "block",
                    width: "100%",
                    height: `${iframeHeight}px`,
                    minHeight: 0,
                    maxHeight: "none",
                    border: 0,
                    overflow: "hidden",
                    background: "transparent",
                }}
                onLoad={() => {
                    setIframeLoaded(true);
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
        </div>
    );
}