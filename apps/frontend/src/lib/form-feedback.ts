import { type ApiError, fieldErrors } from "./api-client.ts";

/** Validation messages keyed by field name, which is also the API's path ("milestones.0.views"). */
export type FieldProblems = Record<string, string>;

export interface FormFeedback {
  /** Messages for individual fields, keyed by field name. */
  fields: FieldProblems;
  /** A message for the whole form, when the problem belongs to no single field. */
  message?: string;
}

/**
 * Feedback for a VALIDATION_ERROR: each detail whose path the form shows goes beside
 * that field, and anything the form cannot place gets one message for the whole form.
 */
export function validationFeedback(error: ApiError, shows: (path: string) => boolean): FormFeedback {
  const all = Object.entries(fieldErrors(error));
  const fields = Object.fromEntries(all.filter(([path]) => shows(path)));
  const unmatched = all.length === 0 || all.length > Object.keys(fields).length;
  return { fields, message: unmatched ? "Some details were not accepted. Check the form and try again." : undefined };
}
