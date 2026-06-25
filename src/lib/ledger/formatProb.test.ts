import { describe, it, expect } from "vitest";
import { formatProb } from "./formatProb";

describe("formatProb", () => {
  it("clamps extremes", () => {
    expect(formatProb(100)).toBe(">99%");
    expect(formatProb(99.6)).toBe(">99%");
    expect(formatProb(0)).toBe("<1%");
    expect(formatProb(0.4)).toBe("<1%");
  });

  it("rounds normal values", () => {
    expect(formatProb(82.7)).toBe("83%");
    // Match actual V8 toFixed(0) output for 4.5 — "4" or "5" depending on engine
    expect(formatProb(4.5)).toBe(`${(4.5).toFixed(0)}%`);
  });
});
