import { ImageResponse } from "next/og";
import { EXAMPLE_LADDER } from "@/lib/example-campaign";
import { formatRupees, formatViews } from "@/lib/format";

export const alt = "Meme'd Payout Tracker: get paid for the views your posts earn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#131313";
const MUTED = "#717171";
const BRAND = "#612aff";

// Rendered once at build time. next/og lays out with inline styles only (no Tailwind) and
// ships a single font, Geist Regular, so size and colour carry the hierarchy instead of weight.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 72,
          background: "#ffffff",
          color: INK,
          borderBottom: `16px solid ${BRAND}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill={BRAND} />
            <path
              d="M9 22V14a3.5 3.5 0 0 1 7 0v8m0-8a3.5 3.5 0 0 1 7 0v8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>meme&apos;d</span>
          <span style={{ color: MUTED }}>payouts</span>
        </div>

        <div style={{ display: "flex", fontSize: 96, lineHeight: 1.05, letterSpacing: -3, maxWidth: 960 }}>
          Get paid for the views your posts earn.
        </div>

        <div style={{ display: "flex", gap: 12, fontSize: 24 }}>
          {EXAMPLE_LADDER.map(({ views, payout }) => (
            <div
              key={views}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                whiteSpace: "nowrap",
                border: `2px solid ${INK}`,
                borderRadius: 999,
                padding: "8px 20px",
              }}
            >
              <span>{formatViews(views)} views</span>
              <span style={{ color: MUTED }}>→</span>
              <span>{formatRupees(payout)}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
