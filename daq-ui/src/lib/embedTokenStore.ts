// daq-ui/src/lib/embedTokenStore.ts
// Central place to retrieve/store the embed token used for protected POST routes.
//
// Priority order:
// 1) Explicitly stored token (localStorage) - useful when token is provided via postMessage/embed handshake
// 2) NEXT_PUBLIC_EMBED_TOKEN - useful for docker/local demos where you want a fixed token
//
// NOTE: NEXT_PUBLIC_* vars are bundled into the client build at build time.

const LS_KEY = "meshdaq_embed_token";

export function getEmbedToken(): string {
    // 1) localStorage (runtime)
    if (typeof window !== "undefined") {
        try {
            const v = window.localStorage.getItem(LS_KEY);
            if (v && v.trim()) return v.trim();
        } catch {
            // ignore
        }
    }

    // 2) build-time env fallback
    const envToken = process.env.NEXT_PUBLIC_EMBED_TOKEN;
    if (envToken && envToken.trim()) return envToken.trim();

    return "";
}

export function setEmbedToken(token: string): void {
    if (typeof window === "undefined") return;
    try {
        if (!token || !token.trim()) {
            window.localStorage.removeItem(LS_KEY);
            return;
        }
        window.localStorage.setItem(LS_KEY, token.trim());
    } catch {
        // ignore
    }
}

export function clearEmbedToken(): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(LS_KEY);
    } catch {
        // ignore
    }
}
