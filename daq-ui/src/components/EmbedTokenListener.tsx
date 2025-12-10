// daq-ui/src/components/EmbedTokenListener.tsx
'use client';

import { useEffect } from 'react';
import { setEmbedToken } from '@/lib/embedTokenStore';

export default function EmbedTokenListener() {
    useEffect(() => {
        function handleMessage(ev: MessageEvent) {
            const data = ev.data;
            if (
                data &&
                typeof data === 'object' &&
                data.kind === 'portfolio-embed-token' &&
                typeof data.token === 'string'
            ) {
                setEmbedToken(data.token);
            }
        }

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return null; // no UI
}
