/**
 * Single source of truth for anything that ends up in a <meta> tag, the
 * sitemap, or a JSON-LD block. Keeping it here means the canonical host is
 * declared once — every other file derives from `siteUrl`.
 */

function resolveSiteUrl(): string {
  // Explicit wins: this is what you set once a real domain is attached.
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  // Vercel injects the stable production host on every deployment, so preview
  // builds still emit absolute URLs that point somewhere real. The NEXT_PUBLIC_
  // form is what reaches the browser; the bare form covers server-only callers
  // (metadata, sitemap, robots) if system env exposure is ever turned off.
  const vercelHost =
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) {
    return `https://${vercelHost}`;
  }
  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

export const site = {
  name: "Nova Labs",
  legalName: "Nova Labs Private Limited",
  url: siteUrl,
  /** Kept under ~60 chars so Google doesn't truncate it in results. */
  title: "Nova Labs — 60-Day Virtual Internship for Developers",
  /** ~155 chars: the practical ceiling for a search snippet. */
  description:
    "A 60-day virtual internship that makes you hireable, not just certifiable. Ship 4 live apps, earn a verified certificate, and get a stipend if you place in the top 20%. From ₹1,299.",
  /** Short form for og:description and social cards, where space is tighter. */
  shortDescription:
    "Ship 4 live apps in 60 days. Real internship letter, verified certificate, and a stipend for the top 20%.",
  locale: "en_IN",
  twitter: "@novalabs",
  colors: {
    navy: "#060c1f",
    navy2: "#0a1330",
    cyan: "#22d3ee",
    pink: "#f472b6",
  },
} as const;

/** Price is referenced by both the page copy and the Offer schema. */
export const programme = {
  price: 1299,
  currency: "INR",
  durationDays: 60,
  projects: 4,
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, siteUrl).toString();
}
