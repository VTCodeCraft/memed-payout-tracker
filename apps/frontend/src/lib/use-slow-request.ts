import { useEffect, useState } from "react";

// Render's free tier stops the API when idle, and the first request then waits up to a
// minute while it starts. A request still pending after this long is probably that.
const SLOW_REQUEST_MS = 5_000;

/** True once `pending` has been true for a few seconds, so the UI can explain the wait. */
export function useSlowRequest(pending: boolean): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), SLOW_REQUEST_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [pending]);

  return pending && slow;
}
