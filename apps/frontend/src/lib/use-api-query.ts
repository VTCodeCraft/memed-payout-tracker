import { useEffect, useEffectEvent, useState } from "react";
import { ApiError, apiRequest } from "./api-client.ts";
import type { SignedIn } from "./signed-in.ts";

export type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "success"; data: T };

type Session = Pick<SignedIn, "token" | "expire">;

/**
 * Runs `load` with the signed-in user's token, and again after retry() or when `key`
 * changes. A 401 means the token is no longer accepted, so it ends the session (the layout
 * then sends the user to log in) instead of showing an error. Results are kept per
 * request, so a retry or a new key shows "loading" rather than the previous result.
 */
export function useQuery<T>(key: string, load: (token: string, signal: AbortSignal) => Promise<T>, { token, expire }: Session) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ request: string; state: QueryState<T> } | null>(null);
  const request = `${attempt} ${token} ${key}`;
  const onUnauthorized = useEffectEvent(expire);
  // The latest `load` runs, but only a new request (key, token or retry) starts one.
  const run = useEffectEvent(load);

  useEffect(() => {
    const controller = new AbortController();
    run(token, controller.signal).then(
      (data) => setResult({ request, state: { status: "success", data } }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
          return;
        }
        if (!(error instanceof ApiError)) console.error(error);
        const failure = error instanceof ApiError ? error : new ApiError(0, "UNEXPECTED_RESPONSE", "Something went wrong.");
        setResult({ request, state: { status: "error", error: failure } });
      },
    );
    return () => controller.abort();
  }, [request, token]);

  const state: QueryState<T> = result?.request === request ? result.state : { status: "loading" };
  return { state, retry: () => setAttempt((count) => count + 1) };
}

/** GETs one API endpoint; see useQuery. */
export function useApiQuery<T>(endpoint: string, session: Session) {
  return useQuery(endpoint, (token, signal) => apiRequest<T>(endpoint, { token, signal }), session);
}
