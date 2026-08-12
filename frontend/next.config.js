/** @type {import('next').NextConfig} */

// The API host must be configurable per environment: hardcoding localhost
// meant every deployed build proxied /api/* into the void.
const API_ORIGIN = (
  process.env.API_PROXY_ORIGIN ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8570"
).replace(/\/$/, "");

const nextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Send the full origin to same-site targets but only the origin
          // cross-site: keeps analytics referrers useful without leaking paths
          // that contain certificate ids or reset tokens.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
