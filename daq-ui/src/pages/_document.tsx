// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
    return (
        <Html lang="en">
            <Head />
            <body>
            <Main />
            <NextScript />

            {/* Use Next.js Script with a loading strategy */}
            <Script
                src="https://ai-ui.fullstackjedi.dev/dock/boot.js"
                strategy="afterInteractive"
                data-origin="https://ai-ui.fullstackjedi.dev"
                data-visible="1"
                data-height="360"
            />
            </body>
        </Html>
    );
}
