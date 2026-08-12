import { ImageResponse } from "next/og";
import { programme, site } from "@/lib/seo";

export const runtime = "edge";
export const alt = `${site.name} — 60-day virtual internship for developers`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated at the edge rather than shipped as a static PNG, so the headline
 * numbers can never drift out of sync with the copy on the page.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: site.colors.navy,
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 34, fontWeight: 700, color: "#fff", letterSpacing: -0.5 }}>
            NOVA
          </span>
          <span
            style={{
              background: site.colors.pink,
              color: "#fff",
              fontSize: 17,
              fontWeight: 700,
              padding: "6px 12px",
              borderRadius: 6,
              letterSpacing: 1.4,
            }}
          >
            LABS
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: -2,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>The internship that makes</span>
            {/* Satori collapses whitespace between elements, so the spaces
                either side of the highlighted word are set explicitly. */}
            <span style={{ display: "flex", gap: 18 }}>
              <span>you</span>
              <span style={{ color: site.colors.cyan }}>hireable</span>
              <span>— not just</span>
            </span>
            <span style={{ color: site.colors.pink }}>certifiable</span>
          </div>
        </div>

        {/* Stat strip — mirrors the hero stats on the page */}
        <div style={{ display: "flex", gap: 56, alignItems: "flex-end" }}>
          {[
            [`${programme.durationDays}`, "Day programme"],
            [`${programme.projects}`, "Live apps shipped"],
            [`₹${programme.price.toLocaleString("en-IN")}`, "All-in price"],
            ["Stipend", "For the top 20%"],
          ].map(([value, label]) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: site.colors.cyan }}>
                {value}
              </span>
              <span style={{ fontSize: 19, color: "rgba(255,255,255,.62)" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
