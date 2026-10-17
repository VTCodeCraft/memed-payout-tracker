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

/**
 * The 1-based number of the highest milestone `views` has reached, or 0 below the first.
 * Same rule as the API's payout engine: reaching a threshold exactly counts.
 */
export function highestMilestone(views: number, milestones: Milestone[]): number {
  return milestones.filter((milestone) => views >= milestone.views).length;
}

/**
 * What `views` earn on the ladder: the payout of the highest milestone reached, or 0 below
 * the first. Tiers replace each other and never add up, as in the API's eligiblePayout.
 */
export function eligiblePayout(views: number, milestones: Milestone[]): number {
  return milestones[highestMilestone(views, milestones) - 1]?.payout ?? 0;
}
