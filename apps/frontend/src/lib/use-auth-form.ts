import { type FormEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type FieldProblems, type FormFeedback, authFailure } from "./auth.ts";
import { focusFirstProblem } from "./focus-first-problem.ts";
import { useSlowRequest } from "./use-slow-request.ts";

interface AuthFormOptions<Values, Input> {
  /** Field names in screen order, for mapping API errors and moving focus. */
  fields: readonly string[];
  values: Values;
  check: (values: Values) => { input: Input } | { problems: FieldProblems };
  /** Calls the API and stores the session; the (auth) layout then leaves the page. */
  submit: (input: Input) => Promise<unknown>;
}

/** Submission for the login and signup forms: checks, one request at a time, and feedback. */
export function useAuthForm<Values, Input>({ fields, values, check, submit }: AuthFormOptions<Values, Input>) {
  const [feedback, setFeedback] = useState<FormFeedback>({ fields: {} });
  const [pending, setPending] = useState(false);
  // Set synchronously, unlike state: a second submit in the same task (before React has
  // re-rendered the disabled button) still sees it and stops.
  const inFlight = useRef(false);
  const slow = useSlowRequest(pending);

  // flushSync renders the messages before focus moves, so screen readers announce them.
  function show(form: HTMLFormElement, next: FormFeedback) {
    flushSync(() => setFeedback(next));
    focusFirstProblem(form, fields, next.fields);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;

    const checked = check(values);
    if ("problems" in checked) {
      show(form, { fields: checked.problems });
      return;
    }

    inFlight.current = true;
    setFeedback({ fields: {} });
    setPending(true);
    try {
      // Success stores a session, and the layout leaves the page; the button stays
      // disabled until then.
      await submit(checked.input);
    } catch (error) {
      inFlight.current = false;
      setPending(false);
      show(form, authFailure(error, fields));
    }
  }

  return { feedback, pending, slow, handleSubmit };
}
