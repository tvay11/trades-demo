import { describe, it, expect } from "vitest";
import { approxForecastDirection } from "./direction";

describe("approxForecastDirection", () => {
  it("returns >50 prob-up when median is above last close", () => {
    const r = approxForecastDirection(100, /*p10*/ 95, /*median*/ 108, /*p90*/ 122);
    expect(r.probUp).toBeGreaterThan(50);
    expect(r.expectedMovePct).toBeGreaterThan(0);
  });
  it("returns <50 when median is below last close", () => {
    const r = approxForecastDirection(100, 80, 92, 105);
    expect(r.probUp).toBeLessThan(50);
  });
  it("returns ~50 when median equals last close", () => {
    const r = approxForecastDirection(100, 90, 100, 110);
    expect(Math.abs(r.probUp - 50)).toBeLessThan(2);
  });
  it("guards degenerate inputs", () => {
    expect(approxForecastDirection(0, 0, 0, 0)).toEqual({ probUp: 50, expectedMovePct: 0 });
  });
});
