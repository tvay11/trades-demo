import { describe, it, expect } from "vitest";
import {
  shapeBuySellSentiment,
  type SentimentInput,
} from "./buySellSentiment";

function trade(partial: Partial<SentimentInput>): SentimentInput {
  return {
    date: new Date("2025-09-01T00:00:00Z"),
    transactionType: "Purchase",
    amountMin: 1000,
    amountMax: 1000,
    ...partial,
  };
}

describe("shapeBuySellSentiment", () => {
  it("returns empty array for empty input", () => {
    expect(shapeBuySellSentiment([])).toEqual([]);
  });

  it("computes sentiment as buy total minus sell total per week", () => {
    const out = shapeBuySellSentiment([
      trade({ date: new Date("2025-09-01T00:00:00Z"), transactionType: "Purchase", amountMin: 1000, amountMax: 1000 }),
      trade({ date: new Date("2025-09-02T00:00:00Z"), transactionType: "Sale", amountMin: 300, amountMax: 300 }),
    ]);
    expect(out).toEqual([{ week: "2025-W36", sentiment: 700 }]);
  });

  it("treats Purchase as buy and Sale as sell (case-insensitive)", () => {
    const out = shapeBuySellSentiment([
      trade({ date: new Date("2025-09-01T00:00:00Z"), transactionType: "purchase (full)", amountMin: 100, amountMax: 100 }),
      trade({ date: new Date("2025-09-02T00:00:00Z"), transactionType: "Sale (Partial)", amountMin: 50, amountMax: 50 }),
    ]);
    expect(out[0].sentiment).toBe(50);
  });

  it("ignores non buy/sell transactions like Exchange", () => {
    const out = shapeBuySellSentiment([
      trade({ date: new Date("2025-09-01T00:00:00Z"), transactionType: "Exchange", amountMin: 100, amountMax: 100 }),
    ]);
    expect(out).toEqual([{ week: "2025-W36", sentiment: 0 }]);
  });

  it("sorts buckets by week ascending", () => {
    const out = shapeBuySellSentiment([
      trade({ date: new Date("2025-09-15T00:00:00Z") }), // W38
      trade({ date: new Date("2025-09-01T00:00:00Z") }), // W36
    ]);
    expect(out.map((r) => r.week)).toEqual(["2025-W36", "2025-W38"]);
  });

  it("uses ISO-year for end-of-year edge cases", () => {
    const out = shapeBuySellSentiment([
      trade({ date: new Date("2024-12-30T00:00:00Z") }),
    ]);
    expect(out[0].week).toBe("2025-W01");
  });
});
