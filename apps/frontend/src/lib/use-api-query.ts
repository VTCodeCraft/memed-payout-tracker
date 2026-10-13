import { useEffect, useEffectEvent, useState } from "react";
import { ApiError, apiRequest } from "./api-client.ts";
import type { SignedIn } from "./signed-in.ts";

export type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "success"; data: T };

/**
 * GETs `endpoint` with the signed-in user's token, and again after retry(). A 401 means
 * the token is no longer accepted, so it ends the session (the layout then sends the user
 * to log in) instead of showing an error. Results are kept per request, so a retry or a
 * new endpoint shows "loading" rather than the previous request's data or error.
 */
export function useApiQuery<T>(endpoint: string, { token, expire }: Pick<SignedIn, "token" | "expire">) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: QueryState<T> } | null>(null);
  const key = `${attempt} ${token} ${endpoint}`;
  const onUnauthorized = useEffectEvent(expire);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<T>(endpoint, { token, signal: controller.signal }).then(
      (data) => setResult({ key, state: { status: "success", data } }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
          return;
        }
        if (!(error instanceof ApiError)) console.error(error);
        const failure = error instanceof ApiError ? error : new ApiError(0, "UNEXPECTED_RESPONSE", "Something went wrong.");
        setResult({ key, state: { status: "error", error: failure } });
      },
    );
    return () => controller.abort();
  }, [key, endpoint, token]);

  const state: QueryState<T> = result?.key === key ? result.state : { status: "loading" };
  return { state, retry: () => setAttempt((count) => count + 1) };
}
