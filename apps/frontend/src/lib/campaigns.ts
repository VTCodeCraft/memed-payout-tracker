export const PLATFORMS = ["instagram", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface Milestone {
  views: number;
  payout: number;
}

/** A campaign as the API sends it (CampaignResponse on the server). */
export interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  totalBudget: number;
  spent: number;
  /** totalBudget - spent, computed by the API. */
  remaining: number;
  milestones: Milestone[];
  status: "live" | "exhausted";
  createdAt: string;
}

export const PLATFORM_LABELS: Record<Platform, string> = { instagram: "Instagram", youtube: "YouTube" };

export const STATUS_LABELS: Record<Campaign["status"], string> = { live: "Live", exhausted: "Budget exhausted" };

/** Share of the budget already paid out, as a whole percentage for the budget bar. */
export function spentPercent({ spent, totalBudget }: Pick<Campaign, "spent" | "totalBudget">): number {
  return Math.min(100, Math.round((spent / totalBudget) * 100));
}
