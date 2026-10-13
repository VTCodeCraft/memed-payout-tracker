import { ApiError, apiRequest } from "./api-client.ts";
import { PLATFORM_LABELS, type Platform } from "./campaigns.ts";
import { type FieldProblems, type FormFeedback, validationFeedback } from "./form-feedback.ts";
import type { Submission } from "./submissions.ts";

export interface PostForm {
  postUrl: string;
}

export const POST_FIELDS = ["postUrl"] as const;

// The API's limit on a link's length. Whether it is a valid post link is the API's call:
// its parser decides the platform and canonical URL, and a copy here could drift from it.
const MAX_POST_URL_LENGTH = 2048;

export function checkPost(form: PostForm): { input: PostForm } | { problems: FieldProblems } {
  const postUrl = form.postUrl.trim();
  if (postUrl === "") return { problems: { postUrl: "is required" } };
  if (postUrl.length > MAX_POST_URL_LENGTH) return { problems: { postUrl: `must be at most ${MAX_POST_URL_LENGTH} characters` } };
  return { input: form };
}

/** Submits a post link; the API records it and derives the platform and canonical link. */
export async function submitPost(campaignId: string, { postUrl }: PostForm, token: string) {
  const { submission } = await apiRequest<{ submission: Submission }>("submissions", {
    method: "POST",
    body: { campaignId, postUrl },
    token,
  });
  return submission;
}

/** Turns a failed submission into what the form shows; `platform` is the campaign's. */
export function postFailure(error: unknown, platform: Platform): FormFeedback {
  if (!(error instanceof ApiError)) {
    console.error(error);
    return { fields: {}, message: "Something went wrong. Please try again." };
  }
  switch (error.code) {
    case "VALIDATION_ERROR":
      return validationFeedback(error, (path) => path === "postUrl");
    case "PLATFORM_MISMATCH":
      return { fields: { postUrl: `this campaign only accepts ${PLATFORM_LABELS[platform]} links` } };
    case "DUPLICATE_POST":
      return { fields: { postUrl: "this post has already been submitted" } };
    default:
      if (error.status === 401) return { fields: {}, message: "Your session has ended. Log in again to continue." };
      // CAMPAIGN_NOT_LIVE, NETWORK_ERROR, SERVER_UNAVAILABLE and the rest carry readable messages.
      return { fields: {}, message: error.message };
  }
}
