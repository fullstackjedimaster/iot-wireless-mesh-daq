// src/lib/embedApi.ts
'use client';

import { useEmbedToken } from '@/hooks/useEmbedToken';

export function useEmbedAwareFetch(apiBase: string = '') {
    const token = useEmbedToken();

    async function apiFetch(
        input: string,
        init: RequestInit = {},
    ): Promise<Response> {
        const url = apiBase ? `${apiBase}${input}` : input;

        const headers = new Headers(init.headers || {});
        if (token) {
            headers.set('X-Embed-Token', token);
        }

        const resp = await fetch(url, {
            ...init,
            headers,
            credentials: 'include',
        });

        return resp;
    }

    return { apiFetch, token };
}
