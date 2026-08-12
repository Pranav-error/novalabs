import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Only genuinely public, indexable routes belong here. The dashboard, admin
 * and auth trees are behind a login wall — listing them would just feed
 * Search Console a pile of soft-404s.
 *
 * Certificate (/verify/[certId]) and portfolio (/p/[slug]) pages are public
 * but enumerable only from the database, so they are intentionally omitted
 * until the backend can supply the list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/login"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/signup"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
