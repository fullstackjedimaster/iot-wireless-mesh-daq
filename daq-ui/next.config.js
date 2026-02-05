/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // IMPORTANT: run as a Node server (not static export)
  output: "standalone",

  async headers() {
    const domain = process.env.DOMAIN || "fullstackjedi.dev";
    const csp = [
      "default-src 'self' https:",
      "script-src 'self' 'unsafe-inline' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      `connect-src 'self' https://fullstackjedi.dev https://*.${domain}`,
      `frame-src 'self' https://fullstackjedi.dev https://*.${domain}`,
      `frame-ancestors 'self' https://fullstackjedi.dev https://*.${domain}`
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
  