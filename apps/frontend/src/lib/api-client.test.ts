import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { ApiError, apiRequest, fieldErrors } from "./api-client.ts";

const API = "https://api.example.test";

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Replaces fetch with a stub that records each call and answers with `answer`. */
function stubFetch(answer: (init: RequestInit | undefined) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return answer(init);
  });
  return calls;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Awaits a request that must fail and returns its ApiError. */
async function failure(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request;
  } catch (error) {
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    return error;
  }
  assert.fail("expected the request to fail");
}

describe("apiRequest", () => {
  const originalBase = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API;
  });

  afterEach(() => {
    mock.restoreAll();
    if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalBase;
  });

  it("GETs the endpoint under /api and resolves to the JSON body", async () => {
    const calls = stubFetch(() => json(200, { campaigns: [] }));

    const result = await apiRequest<{ campaigns: unknown[] }>("campaigns/live");

    assert.deepEqual(result, { campaigns: [] });
    assert.equal(calls[0].url, `${API}/api/campaigns/live`);
    assert.equal(calls[0].init?.method, "GET");
    assert.equal(calls[0].init?.body, undefined);
    assert.deepEqual(calls[0].init?.headers, { Accept: "application/json" });
  });

  it("sends the body as JSON and the token as a Bearer header", async () => {
    const calls = stubFetch(() => json(201, { campaign: { id: "c1" } }));

    await apiRequest("campaigns", { method: "POST", body: { name: "Launch" }, token: "header.payload.signature" });

    assert.equal(calls[0].init?.method, "POST");
    assert.equal(calls[0].init?.body, '{"name":"Launch"}');
    assert.deepEqual(calls[0].init?.headers, {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer header.payload.signature",
    });
  });

  it("rejects with the API's own status, code and message", async () => {
    stubFetch(() => json(401, { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }));

    const error = await failure(apiRequest("auth/login", { method: "POST", body: {} }));

    assert.equal(error.status, 401);
    assert.equal(error.code, "INVALID_CREDENTIALS");
    assert.equal(error.message, "Invalid email or password");
    assert.deepEqual(error.details, []);
  });

  it("keeps validation details and maps them onto field paths", async () => {
    stubFetch(() =>
      json(400, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: [
            { path: "email", message: "must be a valid email address" },
            { path: "milestones.0.views", message: "must be at least 1" },
            { path: "email", message: "is required" },
            { path: 7, message: "not a field issue" },
          ],
        },
      }),
    );

    const error = await failure(apiRequest("auth/signup", { method: "POST", body: {} }));

    assert.equal(error.code, "VALIDATION_ERROR");
    assert.equal(error.details.length, 3);
    assert.deepEqual(fieldErrors(error), {
      email: "must be a valid email address",
      "milestones.0.views": "must be at least 1",
    });
  });

  it("reports SERVER_UNAVAILABLE for a 502-504 that has no API error body", async () => {
    for (const response of [
      new Response("<html>Bad Gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } }),
      json(503, { status: "unavailable", database: "disconnected", uptime: 3 }),
    ]) {
      stubFetch(() => response);

      const error = await failure(apiRequest("health"));

      assert.equal(error.status, response.status);
      assert.equal(error.code, "SERVER_UNAVAILABLE");
      mock.restoreAll();
    }
  });

  it("reports UNEXPECTED_RESPONSE for other errors without an API error body", async () => {
    stubFetch(() => new Response("Internal Server Error", { status: 500 }));

    const error = await failure(apiRequest("campaigns/mine"));

    assert.equal(error.status, 500);
    assert.equal(error.code, "UNEXPECTED_RESPONSE");
    assert.match(error.message, /HTTP 500/);
  });

  it("rejects a successful response whose body is not JSON", async () => {
    stubFetch(() => new Response("<html>ok</html>", { status: 200 }));

    const error = await failure(apiRequest("health"));

    assert.equal(error.status, 200);
    assert.equal(error.code, "UNEXPECTED_RESPONSE");
  });

  it("reports NETWORK_ERROR with status 0 when no response arrives", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    const error = await failure(apiRequest("health"));

    assert.equal(error.status, 0);
    assert.equal(error.code, "NETWORK_ERROR");
  });

  it("passes a cancellation through as the AbortError, not as an ApiError", async () => {
    stubFetch((init) => Promise.reject(init?.signal?.reason));
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(apiRequest("health", { signal: controller.signal }), { name: "AbortError" });
  });
});
