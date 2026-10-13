import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { ApiError } from "./api-client.ts";
import {
  LOGIN_FIELDS,
  SIGNUP_FIELDS,
  type SignupForm,
  authFailure,
  checkLogin,
  checkSignup,
  homePath,
  logIn,
  signUp,
} from "./auth.ts";
import { SessionStorageError, getSession } from "./session.ts";

class MemoryStorage implements Storage {
  private items = new Map<string, string>();
  get length() {
    return this.items.size;
  }
  clear() {
    this.items.clear();
  }
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

const creator = {
  id: "665f1c2e8b3e4a0012345678",
  name: "Clip Factory",
  email: "clips@example.test",
  role: "creator",
  createdAt: "2026-10-13T10:00:00.000Z",
};

function stubFetch(answer: () => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return answer();
  });
  return calls;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const apiError = (status: number, code: string, message: string, details: { path: string; message: string }[] = []) =>
  new ApiError(status, code, message, details);

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true, writable: true });
});

afterEach(() => {
  mock.restoreAll();
  Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true, writable: true });
});

describe("homePath", () => {
  it("sends each role to its own area", () => {
    assert.equal(homePath("brand"), "/brand");
    assert.equal(homePath("creator"), "/creator");
  });
});

describe("checkSignup", () => {
  const valid: SignupForm = { name: "Clip Factory", email: "clips@example.test", password: "long enough", role: "creator" };

  it("accepts a complete form and passes the values through unchanged", () => {
    assert.deepEqual(checkSignup({ ...valid, name: " Clip Factory " }), {
      input: { ...valid, name: " Clip Factory " },
    });
  });

  it("reports every missing field", () => {
    assert.deepEqual(checkSignup({ name: " ", email: "", password: "", role: "" }), {
      problems: { name: "is required", email: "is required", password: "is required", role: "choose brand or creator" },
    });
  });

  it("applies the API's length and format rules", () => {
    const cases: [Partial<SignupForm>, string, string][] = [
      [{ name: " A " }, "name", "must be at least 2 characters"],
      [{ name: "x".repeat(61) }, "name", "must be at most 60 characters"],
      [{ email: "clips@example" }, "email", "must be a valid email address"],
      [{ password: "seven77" }, "password", "must be at least 8 characters"],
      // 25 characters but 75 bytes: bcrypt reads bytes, so the byte limit applies.
      [{ password: "€".repeat(25) }, "password", "must be at most 72 bytes"],
    ];
    for (const [change, field, message] of cases) {
      assert.deepEqual(checkSignup({ ...valid, ...change }), { problems: { [field]: message } }, field);
    }
  });
});

describe("signUp", () => {
  it("posts the form and stores the returned session", async () => {
    const calls = stubFetch(() => json(201, { token: "token-1", user: creator }));
    const input = { name: "Clip Factory", email: "clips@example.test", password: "long enough", role: "creator" } as const;

    const session = await signUp(input);

    assert.match(calls[0].url, /\/api\/auth\/signup$/);
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), input);
    assert.deepEqual(session, { token: "token-1", user: { id: creator.id, name: "Clip Factory", role: "creator" } });
    assert.deepEqual(getSession(), session);
  });

  it("stores nothing when the API refuses the signup", async () => {
    stubFetch(() => json(409, { error: { code: "EMAIL_TAKEN", message: "An account with this email already exists" } }));

    await assert.rejects(
      signUp({ name: "Clip Factory", email: "clips@example.test", password: "long enough", role: "creator" }),
      { name: "ApiError", code: "EMAIL_TAKEN" },
    );
    assert.equal(getSession(), null);
  });
});

describe("authFailure", () => {
  it("puts validation messages on the matching fields", () => {
    const error = apiError(400, "VALIDATION_ERROR", "Request validation failed", [
      { path: "email", message: "must be a valid email address" },
      { path: "password", message: "must be at least 8 characters" },
    ]);

    assert.deepEqual(authFailure(error, SIGNUP_FIELDS), {
      fields: { email: "must be a valid email address", password: "must be at least 8 characters" },
      message: undefined,
    });
  });

  it("adds a form message when a validation problem matches no field", () => {
    const error = apiError(400, "VALIDATION_ERROR", "Request validation failed", [
      { path: "", message: "expected object" },
    ]);

    const feedback = authFailure(error, SIGNUP_FIELDS);

    assert.deepEqual(feedback.fields, {});
    assert.match(feedback.message ?? "", /not accepted/);
  });

  it("marks a taken email on the email field", () => {
    const feedback = authFailure(apiError(409, "EMAIL_TAKEN", "An account with this email already exists"), SIGNUP_FIELDS);

    assert.deepEqual(feedback, { fields: { email: "an account with this email already exists" } });
  });

  it("explains rate limiting, network failures and a sleeping server", () => {
    const cases: [ApiError, RegExp][] = [
      [apiError(429, "RATE_LIMITED", "Too many requests, please try again later"), /Wait a few minutes/],
      [apiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again."), /Could not reach/],
      [apiError(503, "SERVER_UNAVAILABLE", "The server is starting up or unavailable. Please try again in a minute."), /starting up/],
    ];
    for (const [error, expected] of cases) {
      const feedback = authFailure(error, SIGNUP_FIELDS);
      assert.deepEqual(feedback.fields, {}, error.code);
      assert.match(feedback.message ?? "", expected, error.code);
    }
  });

  it("explains blocked storage", () => {
    assert.match(authFailure(new SessionStorageError(), SIGNUP_FIELDS).message ?? "", /blocking site storage/);
  });
});

describe("checkLogin", () => {
  it("only checks that both fields are present and the email is shaped like one", () => {
    assert.deepEqual(checkLogin({ email: "", password: "" }), {
      problems: { email: "is required", password: "is required" },
    });
    assert.deepEqual(checkLogin({ email: "not-an-email", password: "x" }), {
      problems: { email: "must be a valid email address" },
    });
    // A short password is still sent: login does not reveal signup's password rules.
    assert.deepEqual(checkLogin({ email: "clips@example.test", password: "x" }), {
      input: { email: "clips@example.test", password: "x" },
    });
  });
});

describe("logIn", () => {
  it("posts the credentials and stores the returned session", async () => {
    const calls = stubFetch(() => json(200, { token: "token-2", user: creator }));

    const session = await logIn({ email: "clips@example.test", password: "long enough" });

    assert.match(calls[0].url, /\/api\/auth\/login$/);
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { email: "clips@example.test", password: "long enough" });
    assert.equal(session.user.role, "creator");
    assert.deepEqual(getSession(), session);
  });

  it("stores nothing and shows one generic message for wrong credentials", async () => {
    stubFetch(() => json(401, { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }));

    const failure = await logIn({ email: "nobody@example.test", password: "wrong" }).catch((error: unknown) => error);

    assert.equal(getSession(), null);
    const feedback = authFailure(failure, LOGIN_FIELDS);
    assert.deepEqual(feedback.fields, {});
    assert.match(feedback.message ?? "", /don't match an account/);
  });

  it("maps the API's validation details onto the login fields", () => {
    const error = apiError(400, "VALIDATION_ERROR", "Request validation failed", [
      { path: "email", message: "must be a valid email address" },
    ]);

    assert.deepEqual(authFailure(error, LOGIN_FIELDS), {
      fields: { email: "must be a valid email address" },
      message: undefined,
    });
  });
});
