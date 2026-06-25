import { describe, it, expect } from "vitest";
import {
  shapeTickerBreakdown,
  computeBuySellStats,
  type BreakdownInput,
} from "./politicianBreakdown";

function trade(partial: Partial<BreakdownInput>): BreakdownInput {
  return {
    ticker: "NVDA",
    transactionType: "Purchase",
    amountMin: 1000,
    amountMax: 15000,
    ...partial,
  };
}

describe("shapeTickerBreakdown", () => {
  it("returns empty array for empty input", () => {
    expect(shapeTickerBreakdown([], 5)).toEqual([]);
  });

  it("aggregates total minimum per ticker, sorted desc", () => {
    const out = shapeTickerBreakdown(
      [
        trade({ ticker: "NVDA", amountMin: 1000, amountMax: 15000 }),
        trade({ ticker: "AAPL", amountMin: 0, amountMax: 1000 }),
        trade({ ticker: "NVDA", amountMin: 0, amountMax: 1000 }),
      ],
      5,
    );
    expect(out).toEqual([
      { name: "NVDA", value: 1000 },
      { name: "AAPL", value: 0 },
    ]);
  });

  it("collapses everything beyond topN into an 'Other' bucket", () => {
    const inputs = ["A", "B", "C", "D", "E"].map((t, i) =>
      trade({ ticker: t, amountMin: i * 1000, amountMax: i * 1000 }),
    );
    const out = shapeTickerBreakdown(inputs, 2);
    expect(out).toEqual([
      { name: "E", value: 4000 },
      { name: "D", value: 3000 },
      { name: "Other", value: 3000 }, // C(2000) + B(1000) + A(0)
    ]);
  });

  it("does not produce an 'Other' bucket when total tickers <= topN", () => {
    const out = shapeTickerBreakdown(
      [
        trade({ ticker: "A", amountMin: 100, amountMax: 100 }),
        trade({ ticker: "B", amountMin: 100, amountMax: 100 }),
      ],
      5,
    );
    expect(out.find((r) => r.name === "Other")).toBeUndefined();
  });
});

describe("computeBuySellStats", () => {
  it("returns zeroed stats for empty input", () => {
    expect(computeBuySellStats([])).toEqual({
      buyCount: 0,
      sellCount: 0,
      otherCount: 0,
      buyTotal: 0,
      sellTotal: 0,
      ratio: null,
    });
  });

  it("counts purchases as buys and sales as sells", () => {
    const out = computeBuySellStats([
      trade({ transactionType: "Purchase", amountMin: 1000, amountMax: 1000 }),
      trade({ transactionType: "Sale (Full)", amountMin: 500, amountMax: 500 }),
      trade({ transactionType: "Sale (Partial)", amountMin: 500, amountMax: 500 }),
      trade({ transactionType: "Exchange", amountMin: 100, amountMax: 100 }),
    ]);
    expect(out).toEqual({
      buyCount: 1,
      sellCount: 2,
      otherCount: 1,
      buyTotal: 1000,
      sellTotal: 1000,
      ratio: 0.5,
    });
  });

  it("ratio is null when sellCount is zero", () => {
    const out = computeBuySellStats([
      trade({ transactionType: "Purchase", amountMin: 1000, amountMax: 1000 }),
    ]);
    expect(out.ratio).toBeNull();
    expect(out.buyCount).toBe(1);
  });
});
