import "../../test/dom.ts";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act } from "react";
import { render, typeInto } from "../../test/render.tsx";
import { PayoutCalculator } from "./payout-calculator.tsx";

const ladder = [
  { views: 10_000, payout: 500 },
  { views: 50_000, payout: 2_000 },
  { views: 1_00_000, payout: 5_000 },
];

const input = (container: Element) => container.querySelector("input");
const result = (container: Element) => container.querySelector("[aria-live]")?.textContent;
const currentRow = (container: Element) =>
  [...container.querySelectorAll("li")].findIndex((row) => row.getAttribute("aria-current") === "step");

describe("PayoutCalculator", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("opens on the hero's example: 60,000 views earn the second milestone", async () => {
    const { container } = await render(<PayoutCalculator milestones={ladder} />);

    assert.equal(input(container)?.value, "60,000");
    assert.equal(
      result(container),
      "60,000 views reach milestone 2 of 3 and earn ₹2,000. At 1,00,000 views the post would earn ₹5,000.",
    );
    assert.equal(currentRow(container), 1);
  });

  it("says how far below the first milestone a count is", async () => {
    const { container } = await render(<PayoutCalculator milestones={ladder} />);

    await typeInto(input(container), "9,999");

    assert.equal(result(container), "9,999 views haven't reached a milestone yet. At 10,000 views the post would earn ₹500.");
    assert.equal(currentRow(container), -1);
  });

  it("counts a threshold reached exactly, and caps the payout at the top milestone", async () => {
    const { container } = await render(<PayoutCalculator milestones={ladder} />);

    await typeInto(input(container), "100000");
    assert.equal(result(container), "1,00,000 views reach the top milestone and earn ₹5,000, the most a post earns here.");
    assert.equal(currentRow(container), 2);

    await typeInto(input(container), "25,00,000");
    assert.equal(result(container), "25,00,000 views reach the top milestone and earn ₹5,000, the most a post earns here.");
  });

  it("asks for a number when the input is not one, and regroups digits when focus leaves", async () => {
    const { container } = await render(<PayoutCalculator milestones={ladder} />);

    await typeInto(input(container), "lots");
    assert.equal(result(container), "Enter a whole number of views, such as 60,000.");
    assert.equal(currentRow(container), -1);

    await typeInto(input(container), "75000");
    await act(async () => input(container)?.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    assert.equal(input(container)?.value, "75,000");
  });
});
