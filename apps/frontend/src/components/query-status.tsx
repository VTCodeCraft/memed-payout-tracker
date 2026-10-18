"use client";

import type { ReactNode } from "react";
import { Alert } from "@/components/alert";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Skeleton } from "@/components/skeleton";
import type { ApiError } from "@/lib/api-client";
import { useSlowRequest } from "@/lib/use-slow-request";

/**
 * Shown while a page's data loads: a skeleton in the shape of what is coming (`children`,
 * or three plain lines), named for screen readers by `label`. Explains the wait if the
 * API is waking up.
 */
export function QueryLoading({ label, children }: { label: string; children?: ReactNode }) {
  const slow = useSlowRequest(true);
  return (
    <div role="status">
      <span className="sr-only">{label}</span>
      {children ?? (
        <div className="flex max-w-xl flex-col gap-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
        </div>
      )}
      {slow && <p className="mt-4 text-sm text-muted">The server sleeps when idle and can take up to a minute to wake up.</p>}
    </div>
  );
}

/** A failed load: what went wrong, in the API's words, and a way to try again. */
export function QueryError({ title, error, onRetry }: { title: string; error: ApiError; onRetry: () => void }) {
  return (
    <Card className="flex max-w-xl flex-col items-start gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <Alert>{error.message}</Alert>
      <Button onClick={onRetry}>Try again</Button>
    </Card>
  );
}
