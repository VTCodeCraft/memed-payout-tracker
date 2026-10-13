"use client";

import { useId, useState } from "react";
import { Alert } from "@/components/alert";
import { AuthSubmit } from "@/components/auth-submit";
import { TextField } from "@/components/text-field";
import { SIGNUP_FIELDS, type SignupForm as SignupValues, checkSignup, signUp } from "@/lib/auth";
import type { Role } from "@/lib/session";
import { useAuthForm } from "@/lib/use-auth-form";

const ROLE_OPTIONS: { role: Role; title: string; description: string }[] = [
  { role: "brand", title: "Brand", description: "Run campaigns with a budget and milestone payouts." },
  { role: "creator", title: "Creator", description: "Post for live campaigns and earn as your views grow." },
];

export function SignupForm() {
  const [values, setValues] = useState<SignupValues>({ name: "", email: "", password: "", role: "" });
  const { feedback, pending, slow, handleSubmit } = useAuthForm({
    fields: SIGNUP_FIELDS,
    values,
    check: checkSignup,
    submit: signUp,
  });
  const roleErrorId = useId();

  const update = (field: keyof SignupValues, value: string) => setValues((current) => ({ ...current, [field]: value }));

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

      <AuthSubmit label="Create account" pendingLabel="Creating account…" pending={pending} slow={slow} />
    </form>
  );
}
