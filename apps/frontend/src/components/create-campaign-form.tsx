"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { RadioCards } from "@/components/radio-cards";
import { TextField } from "@/components/text-field";
import { ApiError } from "@/lib/api-client";
import {
  type CampaignForm,
  MAX_MILESTONES,
  campaignFailure,
  campaignFields,
  checkCampaign,
  createCampaign,
} from "@/lib/campaign-form";
import { type Campaign, PLATFORMS, PLATFORM_LABELS } from "@/lib/campaigns";
import { useSignedInSession } from "@/lib/signed-in";
import { useFormSubmit } from "@/lib/use-form-submit";

const PLATFORM_OPTIONS = PLATFORMS.map((platform) => ({ value: platform, title: PLATFORM_LABELS[platform] }));

interface CreateCampaignFormProps {
  onCreated: (campaign: Campaign) => void;
  onCancel: () => void;
}

export function CreateCampaignForm({ onCreated, onCancel }: CreateCampaignFormProps) {
  const { token, expire } = useSignedInSession();
  const [values, setValues] = useState<CampaignForm>({
    name: "",
    platform: "",
    totalBudget: "",
    milestones: [{ id: 0, views: "", payout: "" }],
  });
  const rows = values.milestones;
  const { feedback, pending, slow, handleSubmit, clearFeedback } = useFormSubmit({
    fields: campaignFields(rows.length),
    values,
    check: checkCampaign,
    submit: async (input) => {
      try {
        onCreated(await createCampaign(input, token));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) expire();
        throw error;
      }
    },
    describeFailure: campaignFailure,
  });
  const ids = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  // The form appears in place of the button that opened it; move focus to it so keyboard
  // and screen-reader users land at its start.
  useEffect(() => heading.current?.focus(), []);

  const update = (change: Partial<CampaignForm>) => setValues((current) => ({ ...current, ...change }));
  const updateRow = (id: number, change: { views?: string; payout?: string }) =>
    update({ milestones: rows.map((row) => (row.id === id ? { ...row, ...change } : row)) });

  // Row errors are keyed by position, so they are cleared when a row is added or removed.
  function addRow() {
    clearFeedback();
    update({ milestones: [...rows, { id: Math.max(...rows.map((row) => row.id)) + 1, views: "", payout: "" }] });
  }
  function removeRow(id: number) {
    clearFeedback();
    update({ milestones: rows.filter((row) => row.id !== id) });
  }

  const ladderError = feedback.fields.milestones;

  return (
    <Card>
      <h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight">
        New campaign
      </h2>
      <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        <TextField
          label="Campaign name"
          name="name"
          maxLength={80}
          value={values.name}
          onChange={(event) => update({ name: event.target.value })}
          error={feedback.fields.name}
        />
        <RadioCards
          legend="Platform"
          name="platform"
          options={PLATFORM_OPTIONS}
          value={values.platform}
          onChange={(platform) => update({ platform })}
          error={feedback.fields.platform}
        />
        <TextField
          label="Total budget (₹)"
          hint="Whole rupees: the most this campaign can ever pay out."
          name="totalBudget"
          inputMode="numeric"
          value={values.totalBudget}
          onChange={(event) => update({ totalBudget: event.target.value })}
          error={feedback.fields.totalBudget}
        />

        {/* Focusable so a problem with the ladder as a whole can move focus here. */}
        <fieldset
          name="milestones"
          tabIndex={-1}
          aria-describedby={[`${ids}-ladder-hint`, ladderError && `${ids}-ladder-error`].filter(Boolean).join(" ")}
        >
          <legend className="text-sm font-semibold">Milestone ladder</legend>
          <p id={`${ids}-ladder-hint`} className="mt-1.5 text-sm text-muted">
            A post earns the payout of the highest milestone its views reach. Each milestone needs more views and a
            higher payout than the one before, and no payout can be more than the total budget.
          </p>
          {ladderError && (
            <p id={`${ids}-ladder-error`} className="mt-1.5 text-sm font-medium text-danger-ink first-letter:uppercase">
              {ladderError}
            </p>
          )}
          <ol className="mt-4 flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={row.id}>
                <div role="group" aria-labelledby={`${ids}-row-${row.id}`} className="rounded-2xl border border-ink p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p id={`${ids}-row-${row.id}`} className="font-semibold">
                      Milestone {index + 1}
                    </p>
                    {rows.length > 1 && (
                      <Button variant="secondary" onClick={() => removeRow(row.id)} disabled={pending}>
                        Remove<span className="sr-only"> milestone {index + 1}</span>
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextField
                      label="Views"
                      name={`milestones.${index}.views`}
                      inputMode="numeric"
                      value={row.views}
                      onChange={(event) => updateRow(row.id, { views: event.target.value })}
                      error={feedback.fields[`milestones.${index}.views`]}
                    />
                    <TextField
                      label="Payout (₹)"
                      name={`milestones.${index}.payout`}
                      inputMode="numeric"
                      value={row.payout}
                      onChange={(event) => updateRow(row.id, { payout: event.target.value })}
                      error={feedback.fields[`milestones.${index}.payout`]}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={addRow} disabled={pending || rows.length >= MAX_MILESTONES}>
              Add milestone
            </Button>
            {rows.length >= MAX_MILESTONES && (
              <p className="text-sm text-muted">A campaign can have up to {MAX_MILESTONES} milestones.</p>
            )}
          </div>
        </fieldset>

        {feedback.message && <Alert>{feedback.message}</Alert>}

        <div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating campaign…" : "Create campaign"}
            </Button>
            <Button variant="secondary" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
          </div>
          {/* Always rendered: a live region must exist before its text changes to be announced. */}
          <p role="status" className="mt-2 text-sm text-muted">
            {slow ? "Still working. The server sleeps when idle and can take up to a minute to wake up." : ""}
          </p>
        </div>
      </form>
    </Card>
  );
}
