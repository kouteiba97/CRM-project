import type { NextConfig } from "next";

/**
 * next-intl's plugin only aliases `next-intl/config` to our request config. We set the alias
 * directly: the plugin pulls in @swc/core, whose native-binding cache check fails on drives that
 * grant other users write access (e.g. D:\ on Windows).
 */
const I18N_REQUEST = "./src/i18n/request.ts";
const dev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy: only this site may run scripts, load data and frame it. Inline
 * scripts stay allowed (Next's streamed payload and the theme boot script); eval and websockets
 * only in development (fast refresh). Google's sign-in page is the one allowed form target.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Headless Chromium for PDFs ships its own binary; bundling it would break it.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  turbopack: {
    resolveAlias: { "next-intl/config": I18N_REQUEST },
  },
  webpack(config) {
    config.resolve.alias["next-intl/config"] = new URL(I18N_REQUEST, import.meta.url).pathname;
    return config;
  },
};

export default nextConfig;
