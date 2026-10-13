import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { loadMyPosts } from "./submissions.ts";

const post = (id: string, campaignId: string) => ({ id, campaignId, platform: "instagram", views: 0 });

function stubApi(submissions: unknown[]) {
  const urls: string[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/submissions/mine")) return new Response(JSON.stringify({ submissions }), { status: 200 });
    const id = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
    return new Response(JSON.stringify({ campaign: { id, name: `Campaign ${id}` } }), { status: 200 });
  });
  return urls;
}

describe("loadMyPosts", () => {
  afterEach(() => mock.restoreAll());

  it("reads each distinct campaign once, however many posts it has", async () => {
    const urls = stubApi([post("s1", "c1"), post("s2", "c1"), post("s3", "c2")]);

    const { submissions, campaigns } = await loadMyPosts("token-c", new AbortController().signal);

    assert.equal(submissions.length, 3);
    assert.deepEqual(
      urls.map((url) => url.replace(/^.*\/api\//, "")),
      ["submissions/mine", "campaigns/c1", "campaigns/c2"],
    );
    assert.equal(campaigns.get("c1")?.name, "Campaign c1");
    assert.equal(campaigns.get("c2")?.name, "Campaign c2");
  });

  it("makes no campaign requests when there are no posts", async () => {
    const urls = stubApi([]);

    const { submissions, campaigns } = await loadMyPosts("token-c", new AbortController().signal);

    assert.deepEqual(submissions, []);
    assert.equal(campaigns.size, 0);
    assert.equal(urls.length, 1);
  });
});
