// @vitest-environment node
import { describe, it, expect } from "vitest";
import { minimumDollars, centsToDollars, dollarsToCentsBigInt } from "./money";

describe("minimumDollars", () => {
  it("returns the minimum disclosed dollars for a $50K-$100K range stored in cents", () => {
    expect(minimumDollars(BigInt(5_000_000), BigInt(10_000_000))).toBe(50_000);
  });

  it("returns 0 when both bounds are null", () => {
    expect(minimumDollars(null, null)).toBe(0);
  });

  it("returns the known floor when only max is null", () => {
    expect(minimumDollars(BigInt(5_000_000), null)).toBe(50_000);
  });

  it("returns 0 when min is null, even if max is known", () => {
    // Without a disclosed floor we cannot assert any minimum dollar amount.
    // Returning max here would contradict the function's conservative contract.
    expect(minimumDollars(null, BigInt(5_000_000))).toBe(0);
  });

  it("accepts plain numbers and bigints interchangeably", () => {
    expect(minimumDollars(100, 300)).toBe(1);
    expect(minimumDollars(BigInt(100), BigInt(300))).toBe(1);
  });
});

describe("centsToDollars", () => {
  it("converts and returns null on null", () => {
    expect(centsToDollars(BigInt(150))).toBe(1.5);
    expect(centsToDollars(null)).toBe(null);
  });
});

describe("dollarsToCentsBigInt", () => {
  it("rounds to nearest cent", () => {
    expect(dollarsToCentsBigInt(1.5)).toBe(BigInt(150));
    expect(dollarsToCentsBigInt(0)).toBe(BigInt(0));
    expect(dollarsToCentsBigInt(99.99)).toBe(BigInt(9999));
  });
});
