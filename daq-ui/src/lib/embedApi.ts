// daq-ui/src/lib/embedApi.ts
"use client";

import { getEmbedToken } from "@/lib/embedTokenStore";
import { useEmbedToken } from "@/hooks/useEmbedToken";

function joinUrl(base: string, path: string): string {
    const b = base.endsWith("/") ? base.slice(0, -1) : base;
    const p = path.startsWith("/") ? path : `/${path}`;
    return base ? `${b}${p}` : path;
}

export async function embedAwareFetch(
    input: string,
    init: RequestInit = {},
    apiBase: string = ""
): Promise<Response> {
    const url = joinUrl(apiBase, input);
    const token = getEmbedToken();

    const headers = new Headers(init.headers || {});

    if (token) {
        headers.set("X-Embed-Token", token);
    }

    return fetch(url, {
        ...init,
        headers,
        credentials: init.credentials ?? "omit",
    });
}

export function useEmbedAwareFetch(apiBase: string = "") {
    const token = useEmbedToken();

    async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
        const url = joinUrl(apiBase, input);

        const headers = new Headers(init.headers || {});

        if (token) {
            headers.set("X-Embed-Token", token);
        }

        return fetch(url, {
            ...init,
            headers,
            credentials: init.credentials ?? "omit",
        });
    }

    return { apiFetch, token };
}