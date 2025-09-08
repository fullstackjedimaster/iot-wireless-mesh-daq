// demo-app/src/pages/_app.tsx  (e.g., daq-ui)
import type { AppProps } from "next/app";
import Script from "next/script";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import "@/app/globals.css";

export default function MyApp({ Component, pageProps }: AppProps) {
    const [inject, setInject] = useState(false);

    useEffect(() => {
        const p = new URLSearchParams(window.location.search);
        setInject(p.get("ai") === "1");
    }, []);

    return (
        <Layout>
            {inject && (
                <Script
                    src="https://ai-ui.fullstackjedi.dev/dock/boot.js"
                    strategy="afterInteractive"
                    data-origin="https://ai-ui.fullstackjedi.dev"
                    data-visible="1"
                    data-height="420"
                    data-frame-id="daq-dock"
                />
            )}
            <Component {...pageProps} />
        </Layout>
    );
}
