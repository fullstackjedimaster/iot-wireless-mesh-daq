"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Attrs } from "@/lib/dock/selection";
import {settings} from "@/lib/settings";

const RAG_API_BASE = settings.RAG_API_BASE;
const CLIENT_NAME = settings.RAG_CLIENT_NAME;
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

type RagClientRow = {
    id: string;
    name: string;
    host_url: string;
};

type MintResponse = {
    token: string;
    exp?: number;
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

export default function DockHost() {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const mintTimerRef = useRef<number | null>(null);

    const [configured, setConfigured] = useState(false);
    const [ragClientId, setClientId] = useState<string | null>(null);

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
        if (!ragBase || !CLIENT_NAME || !dockOrigin) {
            console.log("[DockHost] Not configured.", {
                ragBase,
                CLIENT_NAME,
                dockOrigin,
            });

            setConfigured(false);
            return;
        }

        setConfigured(true);
    }, [ragBase, dockOrigin]);

    useEffect(() => {
        if (!configured) return;

        let cancelled = false;

        async function resolveClient() {
            try {
                setLastError("");

                const res = await fetch(`${ragBase}/api/rag-clients/${ragClientId}`, {
                    cache: "no-store",
                });

                if (!res.ok) {
                    throw new Error(`resolveClient: ${res.status} ${res.statusText}`);
                }

                const list = (await res.json()) as RagClientRow[];
                const match = Array.isArray(list)
                    ? list.find((c) => c?.name === CLIENT_NAME)
                    : null;

                if (!match?.id) {
                    throw new Error(`rag_client not found by name: ${CLIENT_NAME}`);
                }

                if (!cancelled) {
                    setClientId(match.id);
                }
            } catch (err) {
                console.error("[DockHost] Failed to resolve client:", err);

                if (!cancelled) {
                    setClientId(null);
                    setLastError(err instanceof Error ? err.message : String(err));
                }
            }
        }

        void resolveClient();

        return () => {
            cancelled = true;
        };
    }, [configured, ragBase]);

    useEffect(() => {
        if (!configured || !ragClientId) return;

        let cancelled = false;

        function clearMintTimer() {
            if (mintTimerRef.current) {
                window.clearTimeout(mintTimerRef.current);
                mintTimerRef.current = null;
            }
        }

        async function mintSession() {
            try {
                setLastError("");

                const host_url = safeTrimSlash(window.location.origin);

                const res = await fetch(`${ragBase}/session/mint`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    cache: "no-store",
                    body: JSON.stringify({
                        rag_client_id: ragClientId,
                        host_url,
                    }),
                });

                if (!res.ok) {
                    const txt = await res.text().catch(() => "");

                    throw new Error(
                        `mintSession: ${res.status} ${res.statusText}${
                            txt ? ` — ${txt}` : ""
                        }`
                    );
                }

                const data = (await res.json()) as MintResponse;

                if (!data?.token) {
                    throw new Error("mintSession: missing token in response");
                }

                if (cancelled) return;

                setSessionToken(data.token);
                setSessionExp(typeof data.exp === "number" ? data.exp : null);

                clearMintTimer();

                if (typeof data.exp === "number" && data.exp > 0) {
                    const nowSec = Math.floor(Date.now() / 1000);
                    const refreshInSec = Math.max(10, data.exp - nowSec - 30);

                    mintTimerRef.current = window.setTimeout(() => {
                        void mintSession();
                    }, refreshInSec * 1000);
                } else {
                    mintTimerRef.current = window.setTimeout(() => {
                        void mintSession();
                    }, 120_000);
                }
            } catch (err) {
                console.error("[DockHost] mintSession failed:", err);

                if (!cancelled) {
                    setLastError(err instanceof Error ? err.message : String(err));
                }

                clearMintTimer();

                mintTimerRef.current = window.setTimeout(() => {
                    void mintSession();
                }, 5000);
            }
        }

        void mintSession();

        return () => {
            cancelled = true;
            clearMintTimer();
        };
    }, [configured, ragClientId, ragBase]);

    useEffect(() => {
        if (!configured) return;
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
    }, [configured, iframeLoaded, sessionToken, sessionExp, dockOrigin]);

    useEffect(() => {
        if (!configured) return;

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
    }, [configured, dockOrigin]);

    const iframeSrc = useMemo(() => {
        const base = `${dockOrigin}/dock`;

        if (!ragClientId) return base;

        return `${base}?rag_client_id=${encodeURIComponent(String(ragClientId))}`;
    }, [dockOrigin, ragClientId]);

    const statusLine = (() => {
        if (!configured) return "Dock not configured (missing env vars).";
        if (!ragClientId) return lastError ? `Registry: ${lastError}` : "Resolving rag client…";
        if (!sessionToken) return lastError ? `Session: ${lastError}` : "Minting session…";
        if (!iframeLoaded) return "Loading dock…";

        return "Dock connected.";
    })();

    return (
        <div className="fixed bottom-0 left-0 right-0 h-[360px] z-50 border-t bg-white shadow-xl">
            <div className="h-[28px] px-3 flex items-center text-xs border-b bg-white/80">
                <span className="truncate">{statusLine}</span>
            </div>

            <iframe
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