// daq-ui/src/pages/_app.tsx
import type { AppProps } from "next/app";
import Layout from "@/components/Layout";         // renders <EmbedHeightReporter /> once
import "@/app/globals.css";                    // keep if using Pages Router
import Script from "next/script";
import { useEffect, useState } from "react";

const ENV_AI = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

export default function MyApp({ Component, pageProps }: AppProps) {
    const [shouldInject, setShouldInject] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);

        // URL overrides:
        // ?ai=1 forces ON, ?ai=0 forces OFF
        const aiParam = params.get("ai");
        const aiOverride =
            aiParam === "1" ? true :
                aiParam === "0" ? false :
                    null;

        // hostAi=1 means the HOST (portfolio) will render a separate AI iframe,
        // so daq-ui must NOT inject its own dock (to avoid duplication).
        const hostAi = params.get("hostAi") === "1";

        const enabled = aiOverride ?? ENV_AI;
        setShouldInject(enabled && !hostAi);
    }, []);

    return (
        <Layout>
            {shouldInject && (
                <Script
                    src="https://ai-ui.fullstackjedi.dev/dock/boot.js"
                    strategy="afterInteractive"
                    data-origin="https://ai-ui.fullstackjedi.dev"
                    data-visible="1"
                    data-height="420"
                    data-frame-id="daq-dock"   // unique within daq-ui document
                />
            )}
            <Component {...pageProps} />
        </Layout>
    );
}
