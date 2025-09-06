import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
    const aiOrigin = process.env.NEXT_PUBLIC_AI_UI_ORIGIN || "https://mesh-daq.fullstackjedi.dev/ai-demo";
    return (
        <Html lang="en">
            <Head />
            <body>
            <Main />
            <NextScript />
            <Script
                src={`${aiOrigin.replace(/\/$/, "")}/dock/boot.js`}
                strategy="afterInteractive"
                data-origin={aiOrigin}
                data-visible="1"
                data-height="360"
                crossOrigin="anonymous"
            />
            </body>
        </Html>
    );
}
