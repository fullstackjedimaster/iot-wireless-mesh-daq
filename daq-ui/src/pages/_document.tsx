import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
    const ORIGIN = (process.env.NEXT_PUBLIC_AI_UI_ORIGIN || "").replace(/\/$/, "");
    return (
        <Html lang="en">
            <Head />
            <body>
            <Main />
            <NextScript />
            <Script
                id="dock-boot"
                src={`${ORIGIN}/dock/boot.js`}
                strategy="afterInteractive"
                data-origin={ORIGIN}
                data-visible="1"
                data-height="360"
            />
            </body>
        </Html>
    );
}
