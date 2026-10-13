import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate, formatRupees, formatViews } from "./format.ts";

describe("formatRupees", () => {
  it("shows whole rupees with Indian digit grouping", () => {
    assert.equal(formatRupees(0), "₹0");
    assert.equal(formatRupees(500), "₹500");
    assert.equal(formatRupees(2000), "₹2,000");
    assert.equal(formatRupees(100000), "₹1,00,000");
    assert.equal(formatRupees(2147483647), "₹2,14,74,83,647");
  });
});

describe("formatViews", () => {
  it("groups view counts the same way as money", () => {
    assert.equal(formatViews(10000), "10,000");
    assert.equal(formatViews(100000), "1,00,000");
  });
});

describe("formatDate", () => {
  it("uses the date in India, not the server's or browser's time zone", () => {
    assert.equal(formatDate("2026-10-13T10:00:00.000Z"), "13 Oct 2026");
    // 01:30 on the 14th in India.
    assert.equal(formatDate("2026-10-13T20:00:00.000Z"), "14 Oct 2026");
  });
});
