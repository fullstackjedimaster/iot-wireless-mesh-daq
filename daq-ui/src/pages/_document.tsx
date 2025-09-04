import { Html, Head, Main, NextScript } from "next/document"

export default function Document() {
    return (
        <Html lang="en">
            <Head>
                {/* no manual preload needed here for self-hosted fonts via CSS */}
            </Head>
            <body>
            <Main />
            <NextScript />
            </body>
        </Html>
    )
}
