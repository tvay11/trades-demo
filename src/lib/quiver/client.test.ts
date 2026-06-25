import { describe, it, expect } from "vitest";
import { parseAmountRange } from "./client";

describe("parseAmountRange", () => {
  it("parses dollar range", () => {
    expect(parseAmountRange("$1,001 - $15,000")).toEqual({ min: 1001, max: 15000 });
  });
  it("parses single value", () => {
    expect(parseAmountRange("$50,000")).toEqual({ min: 50000, max: 50000 });
  });
  it("returns null on empty", () => {
    expect(parseAmountRange("")).toBeNull();
  });

  it("rejects max < min (trailing dash like '$1,000 -')", () => {
    expect(parseAmountRange("$1,000 -")).toBeNull();
  });

  it("handles open-ended '$5,000,000+' as min-only floor", () => {
    expect(parseAmountRange("$5,000,000+")).toEqual({ min: 5_000_000, max: 5_000_000 });
  });

  it("parses K/M/B suffixes", () => {
    expect(parseAmountRange("$5M - $25M")).toEqual({ min: 5_000_000, max: 25_000_000 });
    expect(parseAmountRange("$50M+")).toEqual({ min: 50_000_000, max: 50_000_000 });
    expect(parseAmountRange("$1B")).toEqual({ min: 1_000_000_000, max: 1_000_000_000 });
  });

  it("returns null on garbage", () => {
    expect(parseAmountRange("not a number")).toBeNull();
  });
});
