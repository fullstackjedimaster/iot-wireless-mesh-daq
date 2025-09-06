// /pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
    // Safe on both server/client – read once here.
    const aiOrigin = process.env.NEXT_PUBLIC_AI_UI_ORIGIN || "";

    return (
        <Html lang="en">
            <Head />
            <body>
            <Main />
            <NextScript />

            {/* AI dock bootstrapper (async, lint-friendly) */}
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
