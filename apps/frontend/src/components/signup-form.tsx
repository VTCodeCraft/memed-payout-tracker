"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { type FormFeedback, SIGNUP_FIELDS, type SignupForm as SignupValues, authFailure, checkSignup, signUp } from "@/lib/auth";
import { focusFirstProblem } from "@/lib/focus-first-problem";
import type { Role } from "@/lib/session";
import { useSlowRequest } from "@/lib/use-slow-request";

const ROLE_OPTIONS: { role: Role; title: string; description: string }[] = [
  { role: "brand", title: "Brand", description: "Run campaigns with a budget and milestone payouts." },
  { role: "creator", title: "Creator", description: "Post for live campaigns and earn as your views grow." },
];

export function SignupForm() {
  const [values, setValues] = useState<SignupValues>({ name: "", email: "", password: "", role: "" });
  const [feedback, setFeedback] = useState<FormFeedback>({ fields: {} });
  const [pending, setPending] = useState(false);
  // Set synchronously, unlike state: a second submit in the same task (before React has
  // re-rendered the disabled button) still sees it and stops.
  const inFlight = useRef(false);
  const slow = useSlowRequest(pending);
  const roleErrorId = useId();

  const update = (field: keyof SignupValues, value: string) => setValues((current) => ({ ...current, [field]: value }));

  // flushSync renders the messages before focus moves, so screen readers announce them.
  function show(form: HTMLFormElement, next: FormFeedback) {
    flushSync(() => setFeedback(next));
    focusFirstProblem(form, SIGNUP_FIELDS, next.fields);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;

    const checked = checkSignup(values);
    if ("problems" in checked) {
      show(form, { fields: checked.problems });
      return;
    }

    inFlight.current = true;
    setFeedback({ fields: {} });
    setPending(true);
    try {
      // On success the stored session makes the (auth) layout open the dashboard, so
      // the button stays disabled until the page changes.
      await signUp(checked.input);
    } catch (error) {
      inFlight.current = false;
      setPending(false);
      show(form, authFailure(error, SIGNUP_FIELDS));
    }
  }

  const roleError = feedback.fields.role;

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <TextField
        label="Name"
        hint="Your name, or your brand's name."
        name="name"
        autoComplete="name"
        value={values.name}
        onChange={(event) => update("name", event.target.value)}
        error={feedback.fields.name}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={values.email}
        onChange={(event) => update("email", event.target.value)}
        error={feedback.fields.email}
      />
      <TextField
        label="Password"
        hint="At least 8 characters."
        name="password"
        type="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(event) => update("password", event.target.value)}
        error={feedback.fields.password}
      />

      <fieldset>
        <legend className="text-sm font-semibold">Account type</legend>
        <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
          {ROLE_OPTIONS.map(({ role, title, description }) => (
            <label
              key={role}
              className={`group flex cursor-pointer gap-3 rounded-2xl border p-4 has-checked:bg-lime ${
                roleError ? "border-danger ring-1 ring-danger" : "border-ink"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={role}
                checked={values.role === role}
                onChange={() => update("role", role)}
                aria-describedby={roleError ? roleErrorId : undefined}
                className="mt-1 size-4 shrink-0 accent-ink"
              />
              <span>
                <span className="block font-semibold">{title}</span>
                {/* Ink on lime: muted grey falls below AA contrast once the card is selected. */}
                <span className="block text-sm text-muted group-has-checked:text-ink">{description}</span>
              </span>
            </label>
          ))}
        </div>
        {roleError && (
          <p id={roleErrorId} className="mt-1.5 text-sm font-medium text-danger-ink first-letter:uppercase">
            {roleError}
          </p>
        )}
      </fieldset>

      {feedback.message && <Alert>{feedback.message}</Alert>}

      <div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
        {/* Always rendered: a live region must exist before its text changes to be announced. */}
        <p role="status" className="mt-2 text-sm text-muted">
          {slow ? "Still working. The server sleeps when idle and can take up to a minute to wake up." : ""}
        </p>
      </div>
    </form>
  );
}
