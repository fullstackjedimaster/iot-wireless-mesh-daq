"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import GroupBox from "@/components/GroupBox";
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

// function getInitialRagClientIdFromUrl(): string | null {
//     if (typeof window === "undefined") return null;
//
//     const params = new URLSearchParams(window.location.search);
//     const ragClientId = params.get("ragClientId") ?? params.get("ragclientid");
//
//     return ragClientId && ragClientId.trim() ? ragClientId.trim() : null;
// }

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

function clampDockHeight(height:number){
    return Math.max(
        220,
        Math.min(height,420)
    );
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
    const [iframeHeight, setIframeHeight] = useState(520);
    const [lastError, setLastError] = useState<string>("");

    const dockOrigin = useMemo(() => {
        return DOCK_ORIGIN ? safeTrimSlash(DOCK_ORIGIN) : "";
    }, []);

    const ragBase = useMemo(() => {
        return RAG_API_BASE ? safeTrimSlash(RAG_API_BASE) : "";
    }, []);

    useEffect(() => {
        if (!ragBase || !dockOrigin) {
            setConfigured(false);
            return;
        }

        setConfigured(true);
    }, [ragBase, dockOrigin]);

    // useEffect(() => {
    //     if (!configured) return;
    //
    //     const initialRagClientId = getInitialRagClientIdFromUrl();
    //
    //     if (!initialRagClientId) return;
    //
    //     const url = new URL("/dock", dockOrigin);
    //     url.searchParams.set("ragClientId", initialRagClientId);
    //
    //     setAttached(true);
    //     setRagClientId(initialRagClientId);
    //     setDockUrl(url.toString());
    // }, [configured, dockOrigin]);

    useEffect(() => {
        if (!configured) return;

        function onMessage(ev: MessageEvent<unknown>) {
            if (dockOrigin && ev.origin !== dockOrigin) {
                return;
            }

            const data = ev.data;

            if (
                data &&
                typeof data === "object" &&
                "type" in data &&
                data.type === "RAG_DOCK_RESIZE" &&
                "height" in data &&
                typeof data.height === "number"
            ) {
                setIframeHeight(clampDockHeight(data.height));
                return;
            }

            const connectMsg = parseConnectMessage(ev.data);

            if (connectMsg) {
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
            window.removeEventListener("panel-selected", onPanelSelected as EventListener);
        };
    }, [configured, attached, dockOrigin]);

    const iframeSrc = useMemo(() => {
        if (dockUrl) return dockUrl;

        const base = `${dockOrigin}/dock`;

        if (!ragClientId) return base;

        return `${base}?ragClientId=${encodeURIComponent(ragClientId)}`;
    }, [dockOrigin, dockUrl, ragClientId]);

    if (!configured || !attached) {
        return null;
    }

    return (
        <>
            <br />

            <GroupBox title="AI Explanation">
                {lastError ? (
                    <div className="mb-2 text-xs text-red-700">{lastError}</div>
                ) : null}

                <iframe
                    key={ragClientId ?? "no-rag-client"}
                    ref={iframeRef}
                    id={FRAME_ID}
                    src={iframeSrc}

                    className="block w-full border-0 overflow-hidden"
                    style={{
                        height: `${iframeHeight}px`,
                        overflow: "hidden",
                    }}
                    onLoad={() => setIframeLoaded(true)}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                />
            </GroupBox>
        </>
    );
}