import "../../test/dom.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { render } from "../../test/render.tsx";
import { TextField } from "./text-field.tsx";

describe("TextField", () => {
  it("labels the input and describes it with the hint", async () => {
    const { container, unmount } = await render(<TextField label="Password" hint="At least 8 characters." name="password" />);
    const input = container.querySelector("input");
    const label = container.querySelector("label");

    assert.equal(label?.htmlFor, input?.id);
    assert.equal(document.getElementById(input?.getAttribute("aria-describedby") ?? "")?.textContent, "At least 8 characters.");
    assert.equal(input?.hasAttribute("aria-invalid"), false);
    unmount();
  });

  it("marks the input invalid and reads out the error after the hint", async () => {
    const { container, unmount } = await render(
      <TextField label="Password" hint="At least 8 characters." error="must be at least 8 characters" name="password" />,
    );
    const input = container.querySelector("input");
    const described = (input?.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);

    assert.equal(input?.getAttribute("aria-invalid"), "true");
    assert.deepEqual(described, ["At least 8 characters.", "must be at least 8 characters"]);
    unmount();
  });
});
