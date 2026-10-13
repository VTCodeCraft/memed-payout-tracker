import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  type User,
  SessionStorageError,
  clearSession,
  getSession,
  parseSession,
  saveSession,
  subscribeToSession,
  verifySession,
} from "./session.ts";

/** In-memory stand-in for the browser's localStorage. */
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

const KEY = "memed.session";
const brand: User = {
  id: "665f1c2e8b3e4a0012345678",
  name: "Acme Snacks",
  email: "team@acme.test",
  role: "brand",
  createdAt: "2026-10-13T10:00:00.000Z",
};

let storage: MemoryStorage;

function useStorage(value: Storage | undefined) {
  Object.defineProperty(globalThis, "localStorage", { value, configurable: true, writable: true });
}

function stubFetch(answer: () => Response | Promise<Response>) {
  const urls: string[] = [];
  const headers: unknown[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    headers.push(init?.headers);
    return answer();
  });
  return { urls, headers };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  storage = new MemoryStorage();
  useStorage(storage);
});

afterEach(() => {
  mock.restoreAll();
  useStorage(undefined);
});

describe("session storage", () => {
  it("stores only the token, id, name and role", () => {
    saveSession("token-1", brand);

    assert.deepEqual(JSON.parse(storage.getItem(KEY) ?? ""), {
      token: "token-1",
      user: { id: brand.id, name: "Acme Snacks", role: "brand" },
    });
    assert.deepEqual(getSession(), { token: "token-1", user: { id: brand.id, name: "Acme Snacks", role: "brand" } });
  });

  it("returns the same object until the stored value changes", () => {
    saveSession("token-1", brand);
    const first = getSession();

    assert.equal(getSession(), first);
    saveSession("token-2", brand);
    assert.notEqual(getSession(), first);
    assert.equal(getSession()?.token, "token-2");
  });

  it("clears the session", () => {
    saveSession("token-1", brand);

    clearSession();

    assert.equal(storage.getItem(KEY), null);
    assert.equal(getSession(), null);
  });

  it("treats malformed or edited stored values as signed out", () => {
    const user = { id: brand.id, name: brand.name, role: "brand" };
    for (const raw of [
      "not json",
      "null",
      JSON.stringify({ user }),
      JSON.stringify({ token: "", user }),
      JSON.stringify({ token: "t", user: { ...user, role: "admin" } }),
      JSON.stringify({ token: "t", user: { id: brand.id, role: "brand" } }),
    ]) {
      assert.equal(parseSession(raw), null, raw);
    }
    assert.equal(parseSession(null), null);
  });

  it("notifies subscribers on save and clear until they unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribeToSession(() => calls++);

    saveSession("token-1", brand);
    clearSession();
    unsubscribe();
    saveSession("token-2", brand);

    assert.equal(calls, 2);
  });

  it("reads as signed out without storage, as during server rendering", () => {
    useStorage(undefined);

    assert.equal(getSession(), null);
    assert.doesNotThrow(() => clearSession());
    assert.throws(() => saveSession("token-1", brand), SessionStorageError);
  });

  it("reports blocked storage instead of pretending the session was saved", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });

    assert.equal(getSession(), null);
    assert.throws(() => saveSession("token-1", brand), SessionStorageError);
  });
});

describe("verifySession", () => {
  it("asks /auth/me with the token and replaces the stored user with the API's", async () => {
    storage.setItem(KEY, JSON.stringify({ token: "token-1", user: { id: brand.id, name: "Old name", role: "creator" } }));
    const calls = stubFetch(() => json(200, { user: brand }));

    const result = await verifySession("token-1");

    assert.match(calls.urls[0], /\/api\/auth\/me$/);
    assert.deepEqual(calls.headers[0], { Accept: "application/json", Authorization: "Bearer token-1" });
    assert.equal(result.status, "valid");
    assert.deepEqual(getSession()?.user, { id: brand.id, name: "Acme Snacks", role: "brand" });
  });

  it("clears the session when the API rejects the token", async () => {
    for (const code of ["TOKEN_EXPIRED", "INVALID_TOKEN"]) {
      saveSession("token-1", brand);
      stubFetch(() => json(401, { error: { code, message: "rejected" } }));

      const result = await verifySession("token-1");

      assert.equal(result.status, "invalid", code);
      assert.equal(getSession(), null, code);
      mock.restoreAll();
    }
  });

  it("keeps the session when the API cannot be reached or is waking up", async () => {
    for (const answer of [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () => new Response("<html>Service Unavailable</html>", { status: 503 }),
    ]) {
      saveSession("token-1", brand);
      stubFetch(answer);

      const result = await verifySession("token-1");

      assert.equal(result.status, "unreachable");
      assert.equal(getSession()?.token, "token-1");
      mock.restoreAll();
    }
  });

  it("leaves a session another tab stored during the check alone", async () => {
    saveSession("token-1", brand);
    stubFetch(() => {
      saveSession("token-2", { ...brand, name: "Signed in elsewhere" });
      return json(401, { error: { code: "TOKEN_EXPIRED", message: "expired" } });
    });

    const result = await verifySession("token-1");

    assert.equal(result.status, "invalid");
    assert.equal(getSession()?.token, "token-2");
  });
});
