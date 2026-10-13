import "../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { act } from "react";
import { apiError, stubFetch } from "../../test/fetch.ts";
import { click, render, settle, typeInto } from "../../test/render.tsx";
import { SignupForm } from "./signup-form.tsx";

async function fillValidForm(container: Element) {
  await typeInto(container.querySelector('input[name="name"]'), "Clip Factory");
  await typeInto(container.querySelector('input[name="email"]'), "clips@example.test");
  await typeInto(container.querySelector('input[name="password"]'), "long enough");
  await click(container.querySelector('input[value="creator"]'));
}

const submitButton = (container: Element) => container.querySelector<HTMLButtonElement>('button[type="submit"]');

describe("SignupForm", () => {
  afterEach(() => {
    mock.restoreAll();
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("shows each problem beside its field, focuses the first, and sends nothing", async () => {
    const calls = stubFetch(() => new Promise(() => {}));
    const { container } = await render(<SignupForm />);

    await click(submitButton(container));

    assert.equal(calls.length, 0);
    assert.equal((document.activeElement as HTMLInputElement | null)?.name, "name");
    const messages = [...container.querySelectorAll(".text-danger-ink")].map((message) => message.textContent);
    assert.deepEqual(messages, ["is required", "is required", "is required", "choose brand or creator"]);
  });

  it("sends one request even when submitted twice before React re-renders", async () => {
    const calls = stubFetch(() => new Promise(() => {}));
    const { container } = await render(<SignupForm />);
    await fillValidForm(container);

    await act(async () => {
      submitButton(container)?.click();
      submitButton(container)?.click();
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, {
      name: "Clip Factory",
      email: "clips@example.test",
      password: "long enough",
      role: "creator",
    });
    assert.equal(submitButton(container)?.disabled, true);
    assert.equal(submitButton(container)?.textContent, "Creating account…");
  });

  it("puts a taken email on the email field and lets the user try again", async () => {
    stubFetch(() => apiError(409, "EMAIL_TAKEN", "An account with this email already exists"));
    const { container } = await render(<SignupForm />);
    await fillValidForm(container);

    await click(submitButton(container));
    await settle();

    const email = container.querySelector<HTMLInputElement>('input[name="email"]');
    assert.equal(email?.getAttribute("aria-invalid"), "true");
    assert.equal(document.activeElement, email);
    assert.match(container.textContent ?? "", /an account with this email already exists/);
    assert.equal(submitButton(container)?.disabled, false);
    assert.equal(localStorage.getItem("memed.session"), null);
  });
});
