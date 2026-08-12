import type { Metadata } from "next";
import { programme, site } from "@/lib/seo";

// The signup page itself is a client component, so its metadata lives here.
// This also re-enables indexing, which the parent (auth) layout switches off
// for the token-bearing login and password-reset routes.
export const metadata: Metadata = {
  title: "Apply for the internship",
  description: `Apply to the ${site.name} ${programme.durationDays}-day virtual internship. Day 1 is free — no card required. Ship ${programme.projects} live apps and earn a verified certificate from ₹${programme.price.toLocaleString("en-IN")}.`,
  alternates: { canonical: "/signup" },
  robots: { index: true, follow: true },
  openGraph: {
    title: `Apply for the internship | ${site.name}`,
    description: `Day 1 is free — no card required. Ship ${programme.projects} live apps in ${programme.durationDays} days.`,
    url: "/signup",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
