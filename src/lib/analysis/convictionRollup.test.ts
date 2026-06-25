// @vitest-environment node
import { describe, expect, it } from "vitest";
import { rollupTickerConviction } from "./convictionRollup";

describe("rollupTickerConviction", () => {
  it("keeps the strongest trade per ticker", () => {
    const rows = rollupTickerConviction([
      { ticker: "NVDA", side: "long", score: 55, breakdown: [], tradeId: 1 },
      { ticker: "NVDA", side: "long", score: 80, breakdown: [], tradeId: 2 },
      { ticker: "DASH", side: "short", score: 40, breakdown: [], tradeId: 3 },
    ]);
    expect(rows.find((r) => r.ticker === "NVDA")!.score).toBe(80);
    expect(rows.find((r) => r.ticker === "NVDA")!.topTradeId).toBe(2);
    expect(rows).toHaveLength(2);
  });
});
