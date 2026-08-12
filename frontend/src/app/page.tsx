import type { Metadata } from "next";
import LandingClient from "./LandingClient";
import { absoluteUrl, programme, site, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  // `absolute` opts out of the "| Nova Labs" template — the brand is already
  // in this title and repeating it wastes pixels in the SERP.
  title: { absolute: site.title },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: site.title,
    description: site.shortDescription,
  },
};

/**
 * Structured data. Everything here restates a claim the page itself makes —
 * price, duration, project count — because Google penalises schema that
 * describes content the user can't see.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: site.name,
      legalName: site.legalName,
      url: siteUrl,
      description: site.shortDescription,
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      url: siteUrl,
      name: site.name,
      description: site.description,
      publisher: { "@id": absoluteUrl("/#organization") },
      inLanguage: "en-IN",
    },
    {
      "@type": "EducationalOccupationalProgram",
      "@id": absoluteUrl("/#programme"),
      name: "Nova Labs Virtual Internship Programme",
      description:
        "A 60-day virtual internship: 30 days of intensive full-stack training followed by 30 days of real project work. Interns ship 4 deployed applications, receive mentor code reviews, and earn a publicly verifiable certificate and internship letter.",
      url: siteUrl,
      provider: { "@id": absoluteUrl("/#organization") },
      programType: "Internship",
      educationalProgramMode: "online",
      timeToComplete: `P${programme.durationDays}D`,
      occupationalCategory: "Full-Stack Software Developer",
      offers: {
        "@type": "Offer",
        price: programme.price,
        priceCurrency: programme.currency,
        category: "Paid",
        url: absoluteUrl("/login"),
        availability: "https://schema.org/InStock",
      },
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Next injects this verbatim; the object is authored above, not
        // user-supplied, so there is nothing to escape.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingClient />
    </>
  );
}
