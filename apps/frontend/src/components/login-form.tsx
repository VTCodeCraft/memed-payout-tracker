"use client";

import { useState } from "react";
import { Alert } from "@/components/alert";
import { AuthSubmit } from "@/components/auth-submit";
import { TextField } from "@/components/text-field";
import { LOGIN_FIELDS, type LoginForm as LoginValues, authFailure, checkLogin, logIn } from "@/lib/auth";
import { useFormSubmit } from "@/lib/use-form-submit";

export function LoginForm() {
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const { feedback, pending, slow, handleSubmit } = useFormSubmit({
    fields: LOGIN_FIELDS,
    values,
    check: checkLogin,
    submit: logIn,
    describeFailure: (error) => authFailure(error, LOGIN_FIELDS),
  });

  const update = (field: keyof LoginValues, value: string) => setValues((current) => ({ ...current, [field]: value }));

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* "username" is what password managers look for on a sign-in form, even for an email. */}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={values.email}
        onChange={(event) => update("email", event.target.value)}
        error={feedback.fields.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={(event) => update("password", event.target.value)}
        error={feedback.fields.password}
      />

      {feedback.message && <Alert>{feedback.message}</Alert>}

      <AuthSubmit label="Log in" pendingLabel="Logging in…" pending={pending} slow={slow} />
    </form>
  );
}
