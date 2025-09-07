import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
      return (
        <Html lang="en">
            <Head />
            <body>
            <Main />
            <NextScript />
            <Script
                src={`${(process.env.NEXT_PUBLIC_AI_UI_ORIGIN || "https://mesh-daq.fullstackjedi.dev/ai-demo").replace(/\/$/, "")}/dock/boot.js`}
                strategy="afterInteractive"
                data-origin={process.env.NEXT_PUBLIC_AI_UI_ORIGIN}
                data-visible="1"
                data-height="360"
            />
            </body>
        </Html>
    );
}
