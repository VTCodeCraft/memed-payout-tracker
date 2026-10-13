import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { ApiError } from "./api-client.ts";
import { checkPost, postFailure, submitPost } from "./submission-form.ts";

describe("checkPost", () => {
  it("only requires a link within the API's length limit, leaving its format to the API", () => {
    assert.deepEqual(checkPost({ postUrl: "   " }), { problems: { postUrl: "is required" } });
    assert.deepEqual(checkPost({ postUrl: `https://www.instagram.com/p/${"x".repeat(2048)}/` }), {
      problems: { postUrl: "must be at most 2048 characters" },
    });
    // Not a post link, but whether it is one is for the API's parser to say.
    assert.deepEqual(checkPost({ postUrl: "instagram.com/p/CxAbc123" }), { input: { postUrl: "instagram.com/p/CxAbc123" } });
  });
});

describe("submitPost", () => {
  afterEach(() => mock.restoreAll());

  it("posts only the campaign id and the link, and returns the stored submission", async () => {
    const stored = { id: "s1", campaignId: "c1", views: 0 };
    const calls: { url: string; init?: RequestInit }[] = [];
    mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ submission: stored }), { status: 201 });
    });

    const submission = await submitPost("c1", { postUrl: "https://www.instagram.com/p/CxAbc123/" }, "token-c");

    assert.match(calls[0].url, /\/api\/submissions$/);
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      campaignId: "c1",
      postUrl: "https://www.instagram.com/p/CxAbc123/",
    });
    assert.deepEqual(submission, stored);
  });
});

describe("postFailure", () => {
  it("puts the API's verdict on the link beside the field", () => {
    const invalid = new ApiError(400, "VALIDATION_ERROR", "Request validation failed", [
      { path: "postUrl", message: "must be a link to a single Instagram post or reel, or a YouTube video" },
    ]);

    assert.deepEqual(postFailure(invalid, "instagram"), {
      fields: { postUrl: "must be a link to a single Instagram post or reel, or a YouTube video" },
      message: undefined,
    });
  });

  it("names the campaign's platform when the link is for the other one", () => {
    const mismatch = new ApiError(400, "PLATFORM_MISMATCH", "This campaign only accepts youtube posts");

    assert.deepEqual(postFailure(mismatch, "youtube"), { fields: { postUrl: "this campaign only accepts YouTube links" } });
  });

  it("marks a post that was already submitted on the field", () => {
    const duplicate = new ApiError(409, "DUPLICATE_POST", "This post has already been submitted");

    assert.deepEqual(postFailure(duplicate, "instagram"), { fields: { postUrl: "this post has already been submitted" } });
  });

  it("uses the API's message when the campaign stopped accepting posts or the server is unreachable", () => {
    for (const error of [
      new ApiError(409, "CAMPAIGN_NOT_LIVE", "This campaign is no longer accepting submissions"),
      new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again."),
    ]) {
      assert.deepEqual(postFailure(error, "instagram"), { fields: {}, message: error.message });
    }
  });
});
