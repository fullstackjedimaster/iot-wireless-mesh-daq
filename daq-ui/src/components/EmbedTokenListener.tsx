// daq-ui/src/components/EmbedTokenListener.tsx
"use client";

import { useEffect } from "react";
import { setEmbedToken } from "@/lib/embedTokenStore";

export default function EmbedTokenListener() {
    useEffect(() => {
        function handleMessage(ev: MessageEvent) {
            // @ts-expect-error cuz
            const data: never = ev.data;
            if (!data || typeof data !== "object") return;

            // Current portfolio format
            // @ts-expect-error cuz
            if (data.kind === "portfolio-embed-token" && typeof data.token === "string") {
                // @ts-expect-error cuz
                setEmbedToken(data.token);
                return;
            }

            // Alternative common format (if you ever send this)
            // @ts-expect-error cuz
            if ((data.type === "SET_EMBED_TOKEN" || data.type === "EMBED_TOKEN") && typeof data.token === "string") {
                // @ts-expect-error cuz
                setEmbedToken(data.token);
            }
        }

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return null;
}
