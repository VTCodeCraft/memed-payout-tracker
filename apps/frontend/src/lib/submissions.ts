import { apiRequest } from "./api-client.ts";
import type { Campaign, Platform } from "./campaigns.ts";

/** A submitted post as the API sends it (SubmissionResponse on the server). */
export interface Submission {
  id: string;
  campaignId: string;
  platform: Platform;
  /** The link as the creator pasted it. */
  postUrl: string;
  /** The API's canonical https link to the post; safe to use as an href. */
  normalizedUrl: string;
  views: number;
  /** What the views have earned under the ladder. */
  eligiblePayout: number;
  /** What the budget actually paid; less than eligible once the budget ran out. */
  paidPayout: number;
  /** The latest time the views grew unusually fast (10,000 or more an hour), if ever; never affects payouts. */
  viewSpike?: { detectedAt: string; fromViews: number; toViews: number; viewsPerHour: number } | null;
  createdAt: string;
}

/** GET /api/submissions/earnings: the signed-in creator's totals across all posts. */
export interface Earnings {
  totalPaid: number;
  totalEligible: number;
  /** Sum over posts of eligible minus paid: earned, but beyond what budgets could pay. */
  totalUnfunded: number;
  submissionCount: number;
}

export interface MyPosts {
  submissions: Submission[];
  campaigns: ReadonlyMap<string, Campaign>;
}

/**
 * The creator's posts and the campaigns they belong to. A submission only carries its
 * campaign's id, so each distinct campaign is read once with GET /campaigns/:id, which
 * creators may read for any campaign: one request per campaign, not per post.
 */
export async function loadMyPosts(token: string, signal: AbortSignal): Promise<MyPosts> {
  const { submissions } = await apiRequest<{ submissions: Submission[] }>("submissions/mine", { token, signal });
  const ids = [...new Set(submissions.map(({ campaignId }) => campaignId))];
  const campaigns = await Promise.all(
    ids.map(async (id) => {
      const { campaign } = await apiRequest<{ campaign: Campaign }>(`campaigns/${encodeURIComponent(id)}`, { token, signal });
      return campaign;
    }),
  );
  return { submissions, campaigns: new Map(campaigns.map((campaign) => [campaign.id, campaign])) };
}
