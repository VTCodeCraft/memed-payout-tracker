"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Alert, Notice } from "@/components/alert";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { ApiError } from "@/lib/api-client";
import type { Campaign } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import { POST_FIELDS, type PostForm, checkPost, postFailure, submitPost } from "@/lib/submission-form";
import type { Submission } from "@/lib/submissions";
import { useFormSubmit } from "@/lib/use-form-submit";

const LINK_HINTS: Record<Campaign["platform"], string> = {
  instagram: "The full link to one Instagram post or reel, such as https://www.instagram.com/p/…",
  youtube: "The full link to one YouTube video or Short, such as https://www.youtube.com/watch?v=…",
};

interface SubmitPostFormProps {
  campaign: Campaign;
  onSubmitted: (submission: Submission) => void;
}

/**
 * Submits a post link to a live campaign. The link stays in the field after a failure;
 * after a success the field clears and a notice says what was (and was not) done, until
 * the creator starts on another link.
 */
export function SubmitPostForm({ campaign, onSubmitted }: SubmitPostFormProps) {
  const { token, expire } = useSignedInSession();
  const [values, setValues] = useState<PostForm>({ postUrl: "" });
  const [submitted, setSubmitted] = useState(false);
  const notice = useRef<HTMLDivElement>(null);
  const { feedback, pending, slow, handleSubmit } = useFormSubmit({
    fields: POST_FIELDS,
    values,
    check: checkPost,
    submit: async (input) => {
      try {
        const submission = await submitPost(campaign.id, input, token);
        flushSync(() => {
          setValues({ postUrl: "" });
          setSubmitted(true);
          onSubmitted(submission);
        });
        notice.current?.focus();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) expire();
        throw error;
      }
    },
    describeFailure: (error) => postFailure(error, campaign.platform),
  });

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
      {submitted && (
        <Notice ref={notice} tabIndex={-1} tone="success">
          Link submitted. It is listed under your posts with 0 views. This app does not check the post itself: views
          arrive through the view-update feed (simulated here), and payouts follow them.
        </Notice>
      )}
      <TextField
        label="Post link"
        hint={LINK_HINTS[campaign.platform]}
        name="postUrl"
        type="url"
        inputMode="url"
        autoCapitalize="none"
        spellCheck={false}
        value={values.postUrl}
        onChange={(event) => {
          setSubmitted(false);
          setValues({ postUrl: event.target.value });
        }}
        error={feedback.fields.postUrl}
      />
      {feedback.message && <Alert>{feedback.message}</Alert>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit post"}
        </Button>
        {/* Always rendered: a live region must exist before its text changes to be announced. */}
        <p role="status" className="mt-2 text-sm text-muted">
          {slow ? "Still working. The server sleeps when idle and can take up to a minute to wake up." : ""}
        </p>
      </div>
    </form>
  );
}
