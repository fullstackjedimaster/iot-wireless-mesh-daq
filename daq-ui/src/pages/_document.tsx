// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

const aiEnabled = process.env.NEXT_PUBLIC_AI_ENABLED === "true";



export default function Document() {
    return (
        <Html lang="en">
            <Head />
            <body>
            <Main />
            <NextScript />

            {aiEnabled && (
            <Script
                src="https://ai-ui.fullstackjedi.dev/dock/boot.js"
                strategy="afterInteractive"
                data-origin="https://ai-ui.fullstackjedi.dev"
                data-visible="1"
                data-height="360"
            />
                )}
            </body>
        </Html>
    );
}
