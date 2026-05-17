"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Attrs } from "@/lib/dock/selection";
import { settings } from "@/lib/settings";

const RAG_API_BASE = settings.RAG_API_BASE;
const DOCK_ORIGIN = settings.DOCK_ORIGIN;
const FRAME_ID = settings.DOCK_FRAME_ID ?? "daq-dock";

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

function safeTrimSlash(s: string) {
    return s.replace(/\/+$/, "");
}

function isObject(v: unknown): v is Record<string, unknown> {
    return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function getInitialRagClientIdFromUrl(): string | null {
    if (typeof window === "undefined") return null;

    const params = new URLSearchParams(window.location.search);
    const ragClientId = params.get("ragClientId") ?? params.get("ragclientid");

    return ragClientId && ragClientId.trim() ? ragClientId.trim() : null;
}

function parseConnectMessage(data: unknown): RagDockConnectMessage | null {
    if (!isObject(data)) return null;
    if (data.type !== "RAG_DOCK_CONNECT") return null;

    const ragClientId = data.ragClientId;
    const dockUrl = data.dockUrl;

    if (typeof ragClientId !== "string" || !ragClientId.trim()) return null;
    if (typeof dockUrl !== "string" || !dockUrl.trim()) return null;

    return {
        type: "RAG_DOCK_CONNECT",
        ragClientId: ragClientId.trim(),
        dockUrl: dockUrl.trim(),
        label: typeof data.label === "string" ? data.label : undefined,
        hostUrl: typeof data.hostUrl === "string" ? data.hostUrl : undefined,
    };
}

function parseDisconnectMessage(data: unknown): RagDockDisconnectMessage | null {
    if (!isObject(data)) return null;
    if (data.type !== "RAG_DOCK_DISCONNECT") return null;

    return {
        type: "RAG_DOCK_DISCONNECT",
        ragClientId:
            typeof data.ragClientId === "string" && data.ragClientId.trim()
                ? data.ragClientId.trim()
                : undefined,
    };
}

export default function DockHost() {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const [configured, setConfigured] = useState(false);
    const [attached, setAttached] = useState(false);

    const [ragClientId, setRagClientId] = useState<string | null>(null);
    const [dockUrl, setDockUrl] = useState<string | null>(null);
    const [ragClient, setRagClient] = useState<RagClientRow | null>(null);

    const [sessionToken, setSessionToken] = useState<string>("");
    const [sessionExp, setSessionExp] = useState<number | null>(null);

    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [lastError, setLastError] = useState<string>("");

    const dockOrigin = useMemo(() => {
        return DOCK_ORIGIN ? safeTrimSlash(DOCK_ORIGIN) : "";
    }, []);

    const ragBase = useMemo(() => {
        return RAG_API_BASE ? safeTrimSlash(RAG_API_BASE) : "";
    }, []);

    useEffect(() => {
        if (!ragBase || !dockOrigin) {
            console.log("[DockHost] Not configured.", { ragBase, dockOrigin });
            setConfigured(false);
            return;
        }

        setConfigured(true);
    }, [ragBase, dockOrigin]);

    useEffect(() => {
        if (!configured) return;

        const initialRagClientId = getInitialRagClientIdFromUrl();

        if (!initialRagClientId) return;

        const url = new URL("/dock", dockOrigin);
        url.searchParams.set("ragClientId", initialRagClientId);

        setAttached(true);
        setRagClientId(initialRagClientId);
        setDockUrl(url.toString());
    }, [configured, dockOrigin]);

    useEffect(() => {
        if (!configured) return;

        function onMessage(ev: MessageEvent<unknown>) {
            if (dockOrigin && ev.origin !== dockOrigin) {
                return;
            }

            const connectMsg = parseConnectMessage(ev.data);

            if (connectMsg) {
                console.log("[DockHost] Received RAG_DOCK_CONNECT:", connectMsg);

                setLastError("");
                setSessionToken("");
                setSessionExp(null);
                setIframeLoaded(false);
                setRagClient(null);
                setRagClientId(connectMsg.ragClientId);
                setDockUrl(connectMsg.dockUrl);
                setAttached(true);
                return;
            }

            const disconnectMsg = parseDisconnectMessage(ev.data);

            if (disconnectMsg) {
                console.log("[DockHost] Received RAG_DOCK_DISCONNECT:", disconnectMsg);

                setLastError("");
                setSessionToken("");
                setSessionExp(null);
                setIframeLoaded(false);
                setRagClient(null);

                if (!disconnectMsg.ragClientId || disconnectMsg.ragClientId === ragClientId) {
                    setAttached(false);
                    setDockUrl(null);
                    setRagClientId(null);
                }
            }
        }

        window.addEventListener("message", onMessage);

        return () => {
            window.removeEventListener("message", onMessage);
        };
    }, [configured, dockOrigin, ragClientId]);

    useEffect(() => {
        if (!configured || !attached || !ragClientId) return;

        let cancelled = false;

        async function resolveClientById() {
            try {
                setLastError("");

                const res = await fetch(`${ragBase}/api/rag-clients/${ragClientId}`, {
                    cache: "no-store",
                });

                if (!res.ok) {
                    const txt = await res.text().catch(() => "");
                    throw new Error(
                        `resolveClient: ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`
                    );
                }

                const client = (await res.json()) as RagClientRow;

                if (!client?.id) {
                    throw new Error(`resolveClient: missing id for rag_client ${ragClientId}`);
                }

                if (!cancelled) {
                    setRagClient(client);
                }
            } catch (err) {
                console.error("[DockHost] Failed to resolve client:", err);

                if (!cancelled) {
                    setRagClient(null);
                    setLastError(err instanceof Error ? err.message : String(err));
                }
            }
        }

        void resolveClientById();

        return () => {
            cancelled = true;
        };
    }, [configured, attached, ragClientId, ragBase]);

    useEffect(() => {
        if (!configured || !attached || !ragClientId || !ragClient) return;

        console.log("[DockHost] Session mint disabled.");

        setSessionToken("debug-disabled");
        setSessionExp(null);
    }, [configured, attached, ragClientId, ragClient]);

    useEffect(() => {
        if (!configured) return;
        if (!attached) return;
        if (!iframeLoaded) return;
        if (!sessionToken) return;
        if (!iframeRef.current?.contentWindow) return;

        const msg: RagSessionMessage = {
            type: "RAG_SESSION",
            token: sessionToken,
        };

        if (typeof sessionExp === "number") {
            msg.exp = sessionExp;
        }

        iframeRef.current.contentWindow.postMessage(msg, dockOrigin);
    }, [configured, attached, iframeLoaded, sessionToken, sessionExp, dockOrigin]);

    useEffect(() => {
        if (!configured) return;
        if (!attached) return;

        function onPanelSelected(ev: Event) {
            const customEvent = ev as CustomEvent<PanelSelectedDetail>;

            const id = customEvent.detail?.id ?? customEvent.detail?.mac;

            if (!id) return;

            const msg: TargetSelectedMessage = {
                type: "TARGET_SELECTED",
                id: String(id),
                subject_id: String(id),
                attrs: customEvent.detail?.attrs ?? undefined,
                source: customEvent.detail?.source ?? "daq-ui",
            };

            iframeRef.current?.contentWindow?.postMessage(msg, dockOrigin);
        }

        window.addEventListener("panel-selected", onPanelSelected as EventListener);

        return () => {
            window.removeEventListener(
                "panel-selected",
                onPanelSelected as EventListener
            );
        };
    }, [configured, attached, dockOrigin]);

    const iframeSrc = useMemo(() => {
        if (dockUrl) return dockUrl;

        const base = `${dockOrigin}/dock`;

        if (!ragClientId) return base;

        return `${base}?ragClientId=${encodeURIComponent(ragClientId)}`;
    }, [dockOrigin, dockUrl, ragClientId]);

    const statusLine = (() => {
        if (!configured) return "Dock not configured.";
        if (!attached) return "Dock detached.";
        if (!ragClientId) return "Waiting for ragClientId…";
        if (!ragClient) return lastError ? `Registry: ${lastError}` : "Resolving rag client…";
        if (!sessionToken) return lastError ? `Session: ${lastError}` : "Minting session…";
        if (!iframeLoaded) return "Loading dock…";

        return "Dock connected.";
    })();

    if (!configured || !attached) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 h-[360px] z-50 border-t bg-white shadow-xl">
            <div className="h-[28px] px-3 flex items-center text-xs border-b bg-white/80">
                <span className="truncate">{statusLine}</span>
            </div>

            <iframe
                key={ragClientId ?? "no-rag-client"}
                ref={iframeRef}
                id={FRAME_ID}
                src={iframeSrc}
                className="w-full h-[calc(100%-28px)] border-0"
                onLoad={() => setIframeLoaded(true)}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
        </div>
    );
}