import "../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { saveSession } from "../lib/session.ts";
import { render } from "../../test/render.tsx";
import { StartLinks } from "./start-links.tsx";

const links = (container: Element) =>
  [...container.querySelectorAll("a")].map((link) => [link.textContent, link.getAttribute("href")]);

describe("StartLinks", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("sends visitors without a session to sign up", async () => {
    const { container } = await render(<StartLinks />);

    assert.deepEqual(links(container), [
      ["Get started", "/signup"],
      ["How payouts work", "#how-payouts-work"],
    ]);
  });

  it("switches to the user's dashboard as soon as a session is saved", async () => {
    const { container } = await render(<StartLinks />);

    await act(async () => saveSession("token", { id: "user-1", name: "Clip Factory", role: "creator" }));

    assert.deepEqual(links(container), [
      ["Open your dashboard", "/creator"],
      ["How payouts work", "#how-payouts-work"],
    ]);
  });
});
