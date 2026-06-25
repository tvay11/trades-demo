// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatMoney, amountMinimum, compactDate, formatVolume } from "./format";

describe("formatMoney", () => {
  it("formats positives by magnitude", () => {
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(500)).toBe("$500");
    expect(formatMoney(2_500)).toBe("$3K");
    expect(formatMoney(2_500_000)).toBe("$2.5M");
    expect(formatMoney(1_500_000_000)).toBe("$1.5B");
  });

  it("handles negatives with sign in the right place", () => {
    // Was previously producing "$-2000000" / "$-2.0M" — sign inside the $.
    expect(formatMoney(-2_000_000)).toBe("-$2.0M");
    expect(formatMoney(-500)).toBe("-$500");
    expect(formatMoney(-1_500_000_000)).toBe("-$1.5B");
  });
});

describe("amountMinimum", () => {
  it("returns the minimum disclosed value for known buckets", () => {
    expect(amountMinimum("$1K-$15K")).toBe(1_000);
    expect(amountMinimum("$500K-$1M")).toBe(500_000);
  });

  it("returns conservative lower bounds for senior-official buckets", () => {
    expect(amountMinimum("$5M-$25M")).toBe(5_000_000);
    expect(amountMinimum("$25M-$50M")).toBe(25_000_000);
    expect(amountMinimum("$50M+")).toBe(50_000_000);
  });

  it("returns 0 for unknown labels", () => {
    expect(amountMinimum("$1B+")).toBe(0);
    expect(amountMinimum("")).toBe(0);
  });
});

describe("compactDate", () => {
  it("formats YYYY-MM-DD as UTC", () => {
    expect(compactDate("2026-05-17")).toBe("May 17, 2026");
  });
});

describe("formatVolume", () => {
  it("compacts billions/millions/thousands", () => {
    expect(formatVolume(1_250_000_000)).toBe("1.25B");
    expect(formatVolume(1_250_000)).toBe("1.25M");
    expect(formatVolume(850_000)).toBe("850K");
  });
  it("leaves small numbers whole", () => {
    expect(formatVolume(999)).toBe("999");
    expect(formatVolume(0)).toBe("0");
  });
  it("returns an em dash for null/non-finite", () => {
    expect(formatVolume(null)).toBe("—");
    expect(formatVolume(Number.NaN)).toBe("—");
  });
});
