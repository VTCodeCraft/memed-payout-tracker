import type { Platform } from "./campaigns.ts";

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
  createdAt: string;
}
