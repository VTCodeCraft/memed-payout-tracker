"use client";

import { useState } from "react";
import { TextField, type TextFieldProps } from "@/components/text-field";

/**
 * A password input with a toggle that reveals what was typed, so a typo can be caught
 * before submitting. The toggle is a pressed/not-pressed button with a fixed name, the
 * pattern screen readers announce as "Show password, toggle button, pressed".
 */
export function PasswordField(props: Omit<TextFieldProps, "type" | "action">) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      action={
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
          className="absolute inset-y-0 right-1 my-auto flex size-11 items-center justify-center rounded-full text-muted hover:text-ink"
        >
          <EyeIcon crossedOut={visible} />
        </button>
      }
    />
  );
}

/** An eye, crossed out while the password is showing (pressing it then hides it). */
function EyeIcon({ crossedOut }: { crossedOut: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {crossedOut && <path d="m3 3 18 18" />}
    </svg>
  );
}
