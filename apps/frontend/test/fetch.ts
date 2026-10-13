import { mock } from "node:test";

export interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Replaces fetch with a stub that records each request and answers with `answer`. */
export function stubFetch(answer: (call: FetchCall) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: FetchCall = {
      url: String(input),
      method: init?.method ?? "GET",
      // apiRequest always passes headers as a plain object.
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    return answer(call);
  });
  return calls;
}

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

export const apiError = (status: number, code: string, message: string) => json(status, { error: { code, message } });
