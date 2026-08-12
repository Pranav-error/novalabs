import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Authenticated surfaces: nothing here renders without a session,
          // so a crawler only ever sees an empty shell.
          "/admin",
          "/dashboard",
          "/profile",
          "/checkout",
          "/community",
          "/interviews",
          "/leaderboard",
          "/resume",
          "/certificates",
          // Auth flows carry one-time tokens in the query string.
          "/verify-email",
          "/reset-password",
          "/forgot-password",
          // Referral redirector — a bounce, not a page.
          "/r/",
          // Next.js internals and the API proxy.
          "/api/",
          "/_next/",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
