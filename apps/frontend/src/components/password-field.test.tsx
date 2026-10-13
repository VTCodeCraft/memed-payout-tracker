import "../../test/dom.ts";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { click, render, typeInto } from "../../test/render.tsx";
import { PasswordField } from "./password-field.tsx";

describe("PasswordField", () => {
  it("hides the password until the toggle is pressed, and hides it again on a second press", async () => {
    const { container, unmount } = await render(<PasswordField label="Password" name="password" />);
    const input = container.querySelector("input");
    const toggle = container.querySelector('button[aria-label="Show password"]');

    assert.equal(input?.type, "password");
    assert.equal(toggle?.getAttribute("aria-pressed"), "false");

    await click(toggle);
    assert.equal(input?.type, "text");
    assert.equal(toggle?.getAttribute("aria-pressed"), "true");

    await click(toggle);
    assert.equal(input?.type, "password");
    assert.equal(toggle?.getAttribute("aria-pressed"), "false");
    unmount();
  });

  it("keeps what was typed and does not submit the form it sits in", async () => {
    let submits = 0;
    const { container, unmount } = await render(
      <form onSubmit={(event) => { event.preventDefault(); submits += 1; }}>
        <PasswordField label="Password" name="password" />
      </form>,
    );
    const input = container.querySelector("input");
    await typeInto(input, "hunter22");

    await click(container.querySelector('button[aria-label="Show password"]'));

    assert.equal(submits, 0);
    assert.equal(input?.value, "hunter22");
    unmount();
  });
});
