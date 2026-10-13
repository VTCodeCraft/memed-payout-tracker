"use client";

import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import type { ApiError } from "@/lib/api-client";
import { useSlowRequest } from "@/lib/use-slow-request";

/** Shown while a page's data loads; explains the wait if the API is waking up. */
export function QueryLoading({ label }: { label: string }) {
  const slow = useSlowRequest(true);
  return (
    <div role="status" className="text-muted">
      <p>{label}</p>
      {slow && <p className="mt-2 text-sm">The server sleeps when idle and can take up to a minute to wake up.</p>}
    </div>
  );
}

/** A failed load: what went wrong, in the API's words, and a way to try again. */
export function QueryError({ title, error, onRetry }: { title: string; error: ApiError; onRetry: () => void }) {
  return (
    <div className="flex max-w-xl flex-col items-start gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <Alert>{error.message}</Alert>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}
