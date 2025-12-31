// daq-ui/src/lib/embedTokenStore.ts

declare global {
    interface Window {
        __EMBED_TOKEN__?: string;
    }
}

const STORAGE_KEY = "meshdaq_embed_token";

/**
 * Initialize token once on client:
 * - If URL has ?t=..., store it and (optionally) clean URL.
 * - Else if window.__EMBED_TOKEN__ exists, store it.
 * Safe to call multiple times.
 */
export function initEmbedTokenFromBrowser(): void {
    if (typeof window === "undefined") return;

    try {
        const url = new URL(window.location.href);
        const t = url.searchParams.get("t");
        if (t && t.trim()) {
            localStorage.setItem(STORAGE_KEY, t.trim());

            // Optional: remove token from URL for cleanliness
            url.searchParams.delete("t");
            window.history.replaceState({}, "", url.toString());
            return;
        }

        const w = (window.__EMBED_TOKEN__ || "").trim();
        if (w) {
            localStorage.setItem(STORAGE_KEY, w);
        }
    } catch {
        // ignore
    }
}

export function setEmbedToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, token);
}

export function getEmbedToken(): string | null {
    if (typeof window === "undefined") return null;

    // (Re)initialize opportunistically
    initEmbedTokenFromBrowser();

    const token = localStorage.getItem(STORAGE_KEY);
    return token && token.trim() ? token.trim() : null;
}

export function clearEmbedToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
}
