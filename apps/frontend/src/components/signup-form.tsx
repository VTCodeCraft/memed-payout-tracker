"use client";

import { type ReactNode, useState } from "react";
import { Alert } from "@/components/alert";
import { AuthSubmit } from "@/components/auth-submit";
import { PasswordField } from "@/components/password-field";
import { RadioCards } from "@/components/radio-cards";
import { TextField } from "@/components/text-field";
import { SIGNUP_FIELDS, type SignupForm as SignupValues, authFailure, checkSignup, signUp } from "@/lib/auth";
import type { Role } from "@/lib/session";
import { useFormSubmit } from "@/lib/use-form-submit";

const ROLE_OPTIONS: { value: Role; title: string; description: string; icon: ReactNode }[] = [
  { value: "brand", title: "Brand", description: "Run campaigns with a budget and milestone payouts.", icon: <RoleIcon role="brand" /> },
  { value: "creator", title: "Creator", description: "Post for live campaigns and earn as your views grow.", icon: <RoleIcon role="creator" /> },
];

export function SignupForm() {
  const [values, setValues] = useState<SignupValues>({ name: "", email: "", password: "", role: "" });
  const { feedback, pending, slow, handleSubmit } = useFormSubmit({
    fields: SIGNUP_FIELDS,
    values,
    check: checkSignup,
    submit: signUp,
    describeFailure: (error) => authFailure(error, SIGNUP_FIELDS),
  });

  const update = (field: keyof SignupValues, value: string) => setValues((current) => ({ ...current, [field]: value }));

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
      <PasswordField
        label="Password"
        hint="At least 8 characters."
        name="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(event) => update("password", event.target.value)}
        error={feedback.fields.password}
      />

      <RadioCards
        legend="Account type"
        name="role"
        options={ROLE_OPTIONS}
        value={values.role}
        onChange={(role) => update("role", role)}
        error={feedback.fields.role}
        columns={1}
      />

      {feedback.message && <Alert>{feedback.message}</Alert>}

      <AuthSubmit label="Create account" pendingLabel="Creating account…" pending={pending} slow={slow} />
    </form>
  );
}

/** A megaphone for brands, a video camera for creators. */
function RoleIcon({ role }: { role: Role }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {role === "brand" ? (
        <path d="M4 10v4h3l6 4V6l-6 4H4ZM17 9.5a3.5 3.5 0 0 1 0 5" />
      ) : (
        <>
          <rect x="2.5" y="6" width="13" height="12" rx="3" />
          <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
        </>
      )}
    </svg>
  );
}
