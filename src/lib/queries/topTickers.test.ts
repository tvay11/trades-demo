import { describe, it, expect } from "vitest";
import { shapeTopTickers, type TopTickerInput } from "./topTickers";

function trade(partial: Partial<TopTickerInput>): TopTickerInput {
  return {
    ticker: "NVDA",
    amountMin: 1000,
    amountMax: 15000,
    ...partial,
  };
}

describe("shapeTopTickers", () => {
  it("returns empty array for empty input", () => {
    expect(shapeTopTickers([], 15)).toEqual([]);
  });

  it("aggregates count and total minimum per ticker", () => {
    const out = shapeTopTickers(
      [
        trade({ ticker: "NVDA", amountMin: 1000, amountMax: 15000 }),
        trade({ ticker: "NVDA", amountMin: 0, amountMax: 1000 }),
        trade({ ticker: "AAPL", amountMin: 0, amountMax: 1000 }),
      ],
      15,
    );
    const nvda = out.find((r) => r.ticker === "NVDA");
    expect(nvda).toEqual({ ticker: "NVDA", count: 2, total: 1000 });
  });

  it("sorts by total minimum descending", () => {
    const out = shapeTopTickers(
      [
        trade({ ticker: "AAPL", amountMin: 0, amountMax: 1000 }),
        trade({ ticker: "NVDA", amountMin: 1000, amountMax: 15000 }),
        trade({ ticker: "TSLA", amountMin: 100, amountMax: 500 }),
      ],
      15,
    );
    expect(out.map((r) => r.ticker)).toEqual(["NVDA", "TSLA", "AAPL"]);
  });

  it("respects the limit", () => {
    const inputs = ["A", "B", "C", "D", "E"].map((t, i) =>
      trade({ ticker: t, amountMin: i * 1000, amountMax: i * 1000 }),
    );
    const out = shapeTopTickers(inputs, 3);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.ticker)).toEqual(["E", "D", "C"]);
  });

  it("handles null amount bounds as zero contribution", () => {
    const out = shapeTopTickers(
      [
        trade({ ticker: "NVDA", amountMin: null, amountMax: null }),
        trade({ ticker: "NVDA", amountMin: 100, amountMax: null }),
      ],
      15,
    );
    expect(out[0]).toEqual({ ticker: "NVDA", count: 2, total: 100 });
  });
});
