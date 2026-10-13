import { type FormEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { FieldProblems, FormFeedback } from "./auth.ts";
import { focusFirstProblem } from "./focus-first-problem.ts";
import { useSlowRequest } from "./use-slow-request.ts";

interface FormSubmitOptions<Values, Input> {
  /** Field names in screen order, for moving focus to the first problem. */
  fields: readonly string[];
  values: Values;
  check: (values: Values) => { input: Input } | { problems: FieldProblems };
  /** Sends the checked input to the API and handles success. */
  submit: (input: Input) => Promise<unknown>;
  /** Turns a failed submit into field messages and/or a message for the whole form. */
  describeFailure: (error: unknown) => FormFeedback;
}

/** Submission for a form: client checks, one request at a time, and feedback with focus. */
export function useFormSubmit<Values, Input>({ fields, values, check, submit, describeFailure }: FormSubmitOptions<Values, Input>) {
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
      await submit(checked.input);
    } catch (error) {
      show(form, describeFailure(error));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { feedback, pending, slow, handleSubmit };
}
