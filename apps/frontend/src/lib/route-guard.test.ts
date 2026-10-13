import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "./api-client.ts";
import { EXPIRED_LOGIN_PATH, decideAccess } from "./route-guard.ts";
import type { Session } from "./session.ts";

const brand: Session = { token: "token-1", user: { id: "u1", name: "Acme Snacks", role: "brand" } };
const creator: Session = { token: "token-2", user: { id: "u2", name: "Clip Factory", role: "creator" } };
const valid = (session: Session) => ({ token: session.token, result: { status: "valid" as const, session } });

describe("decideAccess", () => {
  it("shows only a loading state until the browser's session has been read", () => {
    assert.deepEqual(decideAccess(undefined, null, "brand"), { view: "loading" });
  });

  it("sends a signed-out visitor to login", () => {
    assert.deepEqual(decideAccess(null, null, "brand"), { view: "redirect", to: "/login" });
    // Signing out from a verified session (the Log out button, or another tab).
    assert.deepEqual(decideAccess(null, valid(brand), "brand"), { view: "redirect", to: "/login" });
  });

  it("explains on the login page when the API rejected the stored token", () => {
    const rejected = { token: "token-1", result: { status: "invalid" as const } };

    assert.deepEqual(decideAccess(null, rejected, "brand"), { view: "redirect", to: EXPIRED_LOGIN_PATH });
    assert.deepEqual(decideAccess(brand, rejected, "brand"), { view: "redirect", to: EXPIRED_LOGIN_PATH });
  });

  it("keeps protected content hidden until the current token is verified", () => {
    assert.deepEqual(decideAccess(brand, null, "brand"), { view: "loading" });
    // A check for an older token says nothing about the current one.
    assert.deepEqual(decideAccess(brand, valid({ ...brand, token: "old" }), "brand"), { view: "loading" });
  });

  it("shows the reason, not the page, when the API cannot be reached", () => {
    const error = new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");

    assert.deepEqual(decideAccess(brand, { token: "token-1", result: { status: "unreachable", error } }, "brand"), {
      view: "error",
      message: "Could not reach the server. Check your connection and try again.",
    });
  });

  it("lets a verified user into their own role's area", () => {
    assert.deepEqual(decideAccess(brand, valid(brand), "brand"), { view: "ready", session: brand });
    assert.deepEqual(decideAccess(creator, valid(creator), "creator"), { view: "ready", session: creator });
  });

  it("sends a user who opens the other role's area to their own", () => {
    assert.deepEqual(decideAccess(brand, valid(brand), "creator"), { view: "redirect", to: "/brand" });
    assert.deepEqual(decideAccess(creator, valid(creator), "brand"), { view: "redirect", to: "/creator" });
  });

  it("goes by the API's role when the stored copy has been edited", () => {
    const edited: Session = { ...creator, user: { ...creator.user, role: "brand" } };

    assert.deepEqual(decideAccess(edited, valid(creator), "brand"), { view: "redirect", to: "/creator" });
  });
});
