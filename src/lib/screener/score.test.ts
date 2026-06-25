import { describe, it, expect } from "vitest";
import { scoreScreenerRow } from "./score";

describe("scoreScreenerRow", () => {
  it("ranks high + accelerating activity above quiet names", () => {
    const hot = scoreScreenerRow({ tradeCount90: 40, tradeCount14: 18, marketCap: 5e10 });
    const quiet = scoreScreenerRow({ tradeCount90: 3, tradeCount14: 0, marketCap: 5e10 });
    expect(hot.score).toBeGreaterThan(quiet.score);
    expect(hot.tags).toContain("heating up");
  });
  it("flags high activity by 90d trade count", () => {
    const busy = scoreScreenerRow({ tradeCount90: 25, tradeCount14: 4, marketCap: 5e10 });
    expect(busy.tags).toContain("high activity");
  });
  it("clamps and handles zero activity", () => {
    const z = scoreScreenerRow({ tradeCount90: 0, tradeCount14: 0, marketCap: null });
    expect(z.score).toBeGreaterThanOrEqual(0);
  });
});
