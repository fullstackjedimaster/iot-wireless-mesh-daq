// /iot-wireless-mesh-daq/daq-ui/src/components/dock/DockHost.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const RAG_BASE = process.env.NEXT_PUBLIC_RAG_CORE_BASE;
const CLIENT_NAME = process.env.NEXT_PUBLIC_RAG_CLIENT_NAME;
const DOCK_ORIGIN = process.env.NEXT_PUBLIC_DOCK_ORIGIN;
const FRAME_ID = process.env.NEXT_PUBLIC_DOCK_FRAME_ID ?? "daq-dock";

// The dock UI should listen for this and store the token in memory (not localStorage).
type RagSessionMessage = { type: "RAG_SESSION"; token: string; exp?: number };

type TargetSelectedMessage = {
    type: "TARGET_SELECTED";
    subject_id: string;
    attrs?: any;
};

type RagClientRow = {
    id: number;
    name: string;
    host_url: string;
};

type MintResponse = {
    token: string;
    exp?: number; // epoch seconds (recommended)
};

function safeTrimSlash(s: string) {
    return s.replace(/\/+$/, "");
}

export default function DockHost() {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const mintTimerRef = useRef<number | null>(null);

    const [configured, setConfigured] = useState(false);
    const [clientId, setClientId] = useState<number | null>(null);

    const [sessionToken, setSessionToken] = useState<string>("");
    const [sessionExp, setSessionExp] = useState<number | null>(null);

    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [lastError, setLastError] = useState<string>("");

    const dockOrigin = useMemo(() => {
        return DOCK_ORIGIN ? safeTrimSlash(DOCK_ORIGIN) : "";
    }, []);

    const ragBase = useMemo(() => {
        return RAG_BASE ? safeTrimSlash(RAG_BASE) : "";
    }, []);

    // --------------------------------------------------
    // 1) Guard: if not configured, we still render a visible dock shell,
    //    but we show a "not configured" message.
    // --------------------------------------------------
    useEffect(() => {
        if (!ragBase || !CLIENT_NAME || !dockOrigin) {
            console.log("[DockHost] Not configured.", { ragBase, CLIENT_NAME, dockOrigin });
            setConfigured(false);
            return;
        }
        setConfigured(true);
    }, [ragBase, dockOrigin]);

    // --------------------------------------------------
    // 2) Resolve rag_client.id by name (from rag-core registry)
    // --------------------------------------------------
    useEffect(() => {
        if (!configured) return;

        let cancelled = false;

        async function resolveClient() {
            try {
                setLastError("");
                const res = await fetch(`${ragBase}/api/rag-clients/json`, { cache: "no-store" });
                if (!res.ok) throw new Error(`resolveClient: ${res.status} ${res.statusText}`);

                const list = (await res.json()) as RagClientRow[];
                const match = Array.isArray(list) ? list.find((c) => c?.name === CLIENT_NAME) : null;

                if (!match?.id) {
                    throw new Error(`rag_client not found by name: ${CLIENT_NAME}`);
                }

                if (!cancelled) setClientId(match.id);
            } catch (err: any) {
                console.error("[DockHost] Failed to resolve client:", err);
                if (!cancelled) {
                    setClientId(null);
                    setLastError(String(err?.message || err));
                }
            }
        }

        resolveClient();
        return () => {
            cancelled = true;
        };
    }, [configured, ragBase]);

    // --------------------------------------------------
    // 3) Mint / refresh session token (asymmetric keys live in rag-core)
    //    We send host_url so rag-core can validate embedder/host if enabled.
    // --------------------------------------------------
    useEffect(() => {
        if (!configured || !clientId) return;

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

                // Important: this is the "embedding host" origin (the app hosting the dock iframe)
                const host_url = safeTrimSlash(window.location.origin);

                const res = await fetch(`${ragBase}/session/mint`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    cache: "no-store",
                    body: JSON.stringify({
                        client_id: clientId,
                        host_url,
                    }),
                });

                if (!res.ok) {
                    const txt = await res.text().catch(() => "");
                    throw new Error(`mintSession: ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
                }

                const data = (await res.json()) as MintResponse;
                if (!data?.token) throw new Error("mintSession: missing token in response");

                if (cancelled) return;

                setSessionToken(data.token);
                setSessionExp(typeof data.exp === "number" ? data.exp : null);

                // Schedule refresh a bit before expiry if exp was provided.
                clearMintTimer();
                if (typeof data.exp === "number" && data.exp > 0) {
                    const nowSec = Math.floor(Date.now() / 1000);
                    const refreshInSec = Math.max(10, data.exp - nowSec - 30); // refresh 30s early, min 10s
                    mintTimerRef.current = window.setTimeout(() => {
                        // fire-and-forget; effect will still be live
                        mintSession().catch(() => {});
                    }, refreshInSec * 1000);
                } else {
                    // No exp: refresh on a conservative interval (2 minutes)
                    mintTimerRef.current = window.setTimeout(() => {
                        mintSession().catch(() => {});
                    }, 120_000);
                }
            } catch (err: any) {
                console.error("[DockHost] mintSession failed:", err);
                if (!cancelled) setLastError(String(err?.message || err));

                // Retry with backoff-ish delay
                clearMintTimer();
                mintTimerRef.current = window.setTimeout(() => {
                    mintSession().catch(() => {});
                }, 5000);
            }
        }

        mintSession();

        return () => {
            cancelled = true;
            clearMintTimer();
        };
    }, [configured, clientId, ragBase]);

    // --------------------------------------------------
    // 4) Whenever iframe loads AND we have a token, deliver it via postMessage()
    // --------------------------------------------------
    useEffect(() => {
        if (!configured) return;
        if (!iframeLoaded) return;
        if (!sessionToken) return;
        if (!iframeRef.current?.contentWindow) return;

        const msg: RagSessionMessage = { type: "RAG_SESSION", token: sessionToken };
        if (typeof sessionExp === "number") msg.exp = sessionExp;

        iframeRef.current.contentWindow.postMessage(msg, dockOrigin);
    }, [configured, iframeLoaded, sessionToken, sessionExp, dockOrigin]);

    // --------------------------------------------------
    // 5) Forward selection events to dock (always; token is separate)
    // --------------------------------------------------
    useEffect(() => {
        if (!configured) return;

        function onPanelSelected(ev: any) {
            const mac = ev?.detail?.mac;
            if (!mac) return;

            const msg: TargetSelectedMessage = {
                type: "TARGET_SELECTED",
                subject_id: String(mac),
                attrs: ev?.detail?.attrs ?? null,
            };

            iframeRef.current?.contentWindow?.postMessage(msg, dockOrigin);
        }

        window.addEventListener("panel-selected", onPanelSelected as any);
        return () => window.removeEventListener("panel-selected", onPanelSelected as any);
    }, [configured, dockOrigin]);

    // --------------------------------------------------
    // Render: ALWAYS VISIBLE (per your request)
    // --------------------------------------------------
    const iframeSrc = useMemo(() => {
        // Keep it stable; if clientId not ready yet, still load dock shell (no client_id)
        const base = `${dockOrigin}/dock`;
        if (!clientId) return base;
        return `${base}?client_id=${encodeURIComponent(String(clientId))}`;
    }, [dockOrigin, clientId]);

    const statusLine = (() => {
        if (!configured) return "Dock not configured (missing env vars).";
        if (!clientId) return lastError ? `Registry: ${lastError}` : "Resolving rag client…";
        if (!sessionToken) return lastError ? `Session: ${lastError}` : "Minting session…";
        if (!iframeLoaded) return "Loading dock…";
        return "Dock connected.";
    })();

    return (
        <div className="fixed bottom-0 left-0 right-0 h-[360px] z-50 border-t bg-white shadow-xl">
            {/* Minimal status strip */}
            <div className="h-[28px] px-3 flex items-center text-xs border-b bg-white/80">
                <span className="truncate">{statusLine}</span>
            </div>

            <iframe
                ref={iframeRef}
                id={FRAME_ID}
                src={iframeSrc}
                className="w-full h-[calc(100%-28px)] border-0"
                onLoad={() => setIframeLoaded(true)}
                // sandbox can be tightened later; keep permissive for now while wiring
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
            />
        </div>
    );
}
