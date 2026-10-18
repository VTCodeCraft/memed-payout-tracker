import type { ReactNode } from "react";
import { type Campaign, PLATFORM_LABELS, type Platform, STATUS_LABELS } from "@/lib/campaigns";

type BadgeTone = "outline" | "ink" | "green" | "lime" | "tint";

// Pill chips as in the Meme'd app screens (outlined "instagram" chips, black step pills).
// Every tone keeps ink text or ink fill, so all pass WCAG AA.
const TONES: Record<BadgeTone, string> = {
  outline: "bg-white text-ink",
  ink: "bg-ink text-white",
  green: "bg-green text-ink",
  lime: "bg-lime text-ink",
  tint: "bg-brand-tint text-ink",
};

/** A short status or category label. The text must make sense without the colour. */
export function Badge({ tone = "outline", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-ink px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** The campaign's platform, with a small glyph so lists can be scanned by platform. */
export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <Badge>
      <PlatformIcon platform={platform} />
      {PLATFORM_LABELS[platform]}
    </Badge>
  );
}

/** Live in green; an exhausted budget in ink, since it no longer takes posts. */
export function CampaignStatusBadge({ status }: { status: Campaign["status"] }) {
  return <Badge tone={status === "live" ? "green" : "ink"}>{STATUS_LABELS[status]}</Badge>;
}

/** Simple monochrome marks, not the platforms' logos: a camera square and a play button. */
function PlatformIcon({ platform }: { platform: Platform }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2}>
      {platform === "instagram" ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5.5" />
          <circle cx="12" cy="12" r="4" />
        </>
      ) : (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="4.5" />
          <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
