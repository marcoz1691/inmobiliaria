import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // No `preload`: this header is sent on every tenant host, and agents do not opt their
  // whole domain (and subdomains) into the HSTS preload list.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // Report-only: an enforcing CSP would need 'unsafe-inline' for Next + JSON-LD and extra
  // hosts for the Meta Pixel (`connect.facebook.net`) and OSM tiles. Tighten later with nonces.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://www.facebook.com",
      "connect-src 'self' https://www.facebook.com https://connect.facebook.net https://graph.facebook.com",
      "font-src 'self' data:",
      "frame-src https://www.facebook.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Tenant is resolved per request from the Host header, so pages render dynamically and
  // published changes are visible immediately. See docs/adr/0001-arquitectura.md.
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
