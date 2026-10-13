import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { apiUrl } from "./api-url.ts";

const RENDER_API = "https://memed-payout-tracker-95ju.onrender.com";

describe("apiUrl", () => {
  it("joins the deployed API origin and an endpoint", () => {
    assert.equal(apiUrl("health", RENDER_API), `${RENDER_API}/api/health`);
  });

  it("ignores trailing slashes on the base", () => {
    assert.equal(apiUrl("health", `${RENDER_API}/`), `${RENDER_API}/api/health`);
    assert.equal(apiUrl("health", `${RENDER_API}///`), `${RENDER_API}/api/health`);
  });

  it("does not duplicate /api when the base already ends with it", () => {
    for (const base of [`${RENDER_API}/api`, `${RENDER_API}/api/`, `${RENDER_API}/API`]) {
      assert.equal(apiUrl("health", base), `${RENDER_API}/api/health`);
    }
  });

  it("accepts endpoints with a leading slash or an api/ prefix", () => {
    for (const endpoint of ["/health", "//health", "api/health", "/api/health"]) {
      assert.equal(apiUrl(endpoint, RENDER_API), `${RENDER_API}/api/health`);
    }
  });

  it("keeps nested paths and query strings intact", () => {
    assert.equal(
      apiUrl("submissions/abc123/views", RENDER_API),
      `${RENDER_API}/api/submissions/abc123/views`,
    );
    assert.equal(
      apiUrl("/campaigns/live?platform=instagram", RENDER_API),
      `${RENDER_API}/api/campaigns/live?platform=instagram`,
    );
  });

  it("only strips a whole api segment from the endpoint", () => {
    assert.equal(apiUrl("apis/health", RENDER_API), `${RENDER_API}/api/apis/health`);
  });

  it("trims whitespace around the configured base", () => {
    assert.equal(apiUrl("health", `  ${RENDER_API}/  `), `${RENDER_API}/api/health`);
  });

  describe("default base from NEXT_PUBLIC_API_URL", () => {
    const original = process.env.NEXT_PUBLIC_API_URL;

    afterEach(() => {
      if (original === undefined) delete process.env.NEXT_PUBLIC_API_URL;
      else process.env.NEXT_PUBLIC_API_URL = original;
    });

    it("uses the environment variable when set", () => {
      process.env.NEXT_PUBLIC_API_URL = `${RENDER_API}/`;
      assert.equal(apiUrl("health"), `${RENDER_API}/api/health`);
    });

    it("falls back to the local API when unset or empty", () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      assert.equal(apiUrl("health"), "http://localhost:4000/api/health");

      process.env.NEXT_PUBLIC_API_URL = "";
      assert.equal(apiUrl("health"), "http://localhost:4000/api/health");
    });
  });
});
