import { ApiError, apiRequest } from "./api-client.ts";
import type { Campaign, Milestone, Platform } from "./campaigns.ts";
import { type FieldProblems, type FormFeedback, validationFeedback } from "./form-feedback.ts";
import { formatRupees } from "./format.ts";

// The API's limits: at most 10 milestones, and money must fit its 32-bit integer fields.
export const MAX_MILESTONES = 10;
const MAX_RUPEES = 2_147_483_647;
const MAX_NAME_LENGTH = 80;

export interface MilestoneRow {
  /** Stable identity for React while rows are added and removed. */
  id: number;
  views: string;
  payout: string;
}

export interface CampaignForm {
  name: string;
  platform: Platform | "";
  totalBudget: string;
  milestones: MilestoneRow[];
}

/** The body of POST /api/campaigns. The API sets brandId, spent and status itself. */
export interface NewCampaign {
  name: string;
  platform: Platform;
  totalBudget: number;
  milestones: Milestone[];
}

/** Field names in screen order; row fields use the API's paths so its errors land on them. */
export function campaignFields(rowCount: number): string[] {
  const rows = Array.from({ length: rowCount }, (_, index) => [`milestones.${index}.views`, `milestones.${index}.payout`]);
  return ["name", "platform", "totalBudget", ...rows.flat(), "milestones"];
}

/** A whole number from what was typed ("50,000" is fine), or the problem with it. */
function readWholeNumber(raw: string, max: number, unit: "rupees" | "views"): number | string {
  const digits = raw.replace(/[\s,]/g, "");
  if (digits === "") return "is required";
  if (!/^\d+$/.test(digits)) return unit === "rupees" ? "must be a whole number of rupees" : "must be a whole number";
  const value = Number(digits);
  if (value < 1) return "must be at least 1";
  if (value > max) return unit === "rupees" ? `must be at most ${formatRupees(max)}` : "is too large";
  return value;
}

/**
 * The API's campaign rules, checked first so each problem can sit beside its field: a row
 * needs more views and a higher payout than the row before, and no payout may exceed the
 * budget. The API repeats these checks and its answer is the one that counts.
 */
export function checkCampaign(form: CampaignForm): { input: NewCampaign } | { problems: FieldProblems } {
  const problems: FieldProblems = {};
  const name = form.name.trim();
  if (name === "") problems.name = "is required";
  else if (name.length > MAX_NAME_LENGTH) problems.name = `must be at most ${MAX_NAME_LENGTH} characters`;
  if (form.platform === "") problems.platform = "choose Instagram or YouTube";

  const budget = readWholeNumber(form.totalBudget, MAX_RUPEES, "rupees");
  if (typeof budget === "string") problems.totalBudget = budget;

  const milestones: Milestone[] = [];
  let previous: { views: number | string; payout: number | string } | undefined;
  form.milestones.forEach((row, index) => {
    const views = readWholeNumber(row.views, Number.MAX_SAFE_INTEGER, "views");
    const payout = readWholeNumber(row.payout, MAX_RUPEES, "rupees");
    const at = `milestones.${index}`;

    if (typeof views === "string") problems[`${at}.views`] = views;
    else if (typeof previous?.views === "number" && views <= previous.views) {
      problems[`${at}.views`] = `must be more than milestone ${index}'s views`;
    }

    if (typeof payout === "string") problems[`${at}.payout`] = payout;
    else if (typeof previous?.payout === "number" && payout <= previous.payout) {
      problems[`${at}.payout`] = `must be more than milestone ${index}'s payout`;
    } else if (typeof budget === "number" && payout > budget) {
      problems[`${at}.payout`] = "cannot be more than the total budget";
    }

    if (typeof views === "number" && typeof payout === "number") milestones.push({ views, payout });
    previous = { views, payout };
  });

  if (Object.keys(problems).length > 0 || form.platform === "" || typeof budget === "string") return { problems };
  return { input: { name: form.name, platform: form.platform, totalBudget: budget, milestones } };
}

/** Creates the campaign and returns it as the API stored it. */
export async function createCampaign({ name, platform, totalBudget, milestones }: NewCampaign, token: string) {
  const { campaign } = await apiRequest<{ campaign: Campaign }>("campaigns", {
    method: "POST",
    body: { name, platform, totalBudget, milestones: milestones.map(({ views, payout }) => ({ views, payout })) },
    token,
  });
  return campaign;
}

const ROW_FIELD = /^milestones\.\d+\.(views|payout)$/;
const FORM_FIELDS = new Set(["name", "platform", "totalBudget", "milestones"]);

/** Turns a failed create into what the form shows. */
export function campaignFailure(error: unknown): FormFeedback {
  if (!(error instanceof ApiError)) {
    console.error(error);
    return { fields: {}, message: "Something went wrong. Please try again." };
  }
  if (error.code === "VALIDATION_ERROR") {
    return validationFeedback(error, (path) => FORM_FIELDS.has(path) || ROW_FIELD.test(path));
  }
  if (error.status === 401) return { fields: {}, message: "Your session has ended. Log in again to continue." };
  // NETWORK_ERROR, SERVER_UNAVAILABLE and the API's own errors already carry readable messages.
  return { fields: {}, message: error.message };
}
