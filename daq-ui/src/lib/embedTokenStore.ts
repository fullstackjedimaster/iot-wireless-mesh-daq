// daq-ui/src/lib/embedTokenStore.ts

declare global {
    interface Window {
        __EMBED_TOKEN__?: string;
    }
}

const STORAGE_KEY = "meshdaq_embed_token";

export function initEmbedTokenFromBrowser(): void {
    if (typeof window === "undefined") return;

    try {
        const url = new URL(window.location.href);

        // Support both param names:
        const t = (url.searchParams.get("t") || "").trim();
        const et = (url.searchParams.get("embed_token") || "").trim();
        const tokenFromQuery = t || et;

        if (tokenFromQuery) {
            localStorage.setItem(STORAGE_KEY, tokenFromQuery);

            // Clean URL
            url.searchParams.delete("t");
            url.searchParams.delete("embed_token");
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
    const t = (token || "").trim();
    if (!t) return;
    localStorage.setItem(STORAGE_KEY, t);
}

export function getEmbedToken(): string | null {
    if (typeof window === "undefined") return null;

    initEmbedTokenFromBrowser();

    const token = localStorage.getItem(STORAGE_KEY);
    return token && token.trim() ? token.trim() : null;
}

export function clearEmbedToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
}
