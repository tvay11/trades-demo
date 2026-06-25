import { describe, expect, it } from "vitest";

import { buildHouseCall } from "./houseCall";
import type { ScorecardRow } from "./types";

const card = (signals: Record<string, "BULL" | "BEAR" | "NEUTRAL">): ScorecardRow[] =>
  Object.entries(signals).map(([label, signal]) => ({ label, value: "x", signal }));

const allBull = card({
  "Trend (50>200)": "BULL",
  "MACD histogram": "BULL",
  "RSI(14)": "NEUTRAL",
  "Bollinger %B": "BULL",
});

describe("buildHouseCall", () => {
  it("returns BUY when technicals + signals all lean bullish", () => {
    const call = buildHouseCall({
      scorecard: allBull,
      lastClose: 100,
      sma50: 95,
      signals: { congressNetFlowLabel: "Buying" },
      fundamentals: { revenueYoYPct: 40 },
    });
    expect(call.rating).toBe("BUY");
    expect(call.drivers.length).toBeGreaterThan(0);
    expect(call.watchTrigger).toContain("95");
    expect(call.synthesis.length).toBeGreaterThan(0);
  });

  it("returns SELL when technicals + congress flow lean bearish", () => {
    const call = buildHouseCall({
      scorecard: card({ "Trend (50>200)": "BEAR", "MACD histogram": "BEAR", "Bollinger %B": "BEAR" }),
      lastClose: 100,
      sma50: 105,
      signals: { congressNetFlowLabel: "Selling" },
      fundamentals: null,
    });
    expect(call.rating).toBe("SELL");
  });

  it("does not reference a price forecast in any driver", () => {
    const call = buildHouseCall({
      scorecard: allBull, lastClose: 100, sma50: 95,
      signals: { congressNetFlowLabel: "Buying" }, fundamentals: { revenueYoYPct: 40 },
    });
    expect(call.drivers.some((d) => /forecast/i.test(d))).toBe(false);
    expect(call.contributions.some((c) => c.label === "Forecast")).toBe(false);
    expect(call.synthesis).not.toMatch(/forecast/i);
  });

  it("works with everything missing (HOLD, no throw)", () => {
    const call = buildHouseCall({
      scorecard: card({ "Trend (50>200)": "NEUTRAL" }),
      lastClose: null, sma50: null, signals: null, fundamentals: null,
    });
    expect(["BUY", "SELL", "HOLD"]).toContain(call.rating);
    expect(call.watchTrigger.length).toBeGreaterThan(0);
  });

  it("exposes score and signed contributions", () => {
    const hc = buildHouseCall({ scorecard: card({ "RSI(14)": "BEAR" }), lastClose: 100, sma50: 100,
      signals: null, fundamentals: null, macro: null, options: null });
    expect(typeof hc.score).toBe("number");
    expect(hc.contributions.some((c) => c.value < 0)).toBe(true);
  });

  it("alt-flow: dark short pressure -0.5, big gov contracts +0.25", () => {
    const base = { scorecard: [], lastClose: 100, sma50: 100, signals: null, fundamentals: null };
    expect(buildHouseCall({ ...base, altFlow: { darkShortExcessPp: 12, govContractUsd180d: null } }).score).toBe(-0.5);
    expect(buildHouseCall({ ...base, altFlow: { darkShortExcessPp: null, govContractUsd180d: 25_000_000 } }).score).toBe(0.25);
    expect(buildHouseCall({ ...base, altFlow: { darkShortExcessPp: 3, govContractUsd180d: 1_000_000 } }).score).toBe(0);
  });

  it("adds +0.5 for improving street momentum and +0.5 for an active positive PEAD window", () => {
    const base = { scorecard: [], lastClose: 100, sma50: 100, signals: null, fundamentals: null };
    const up = buildHouseCall({ ...base, street: { read: "improving", peadActive: true, peadDirection: "up" } });
    expect(up.score).toBe(1);
    expect(up.drivers.join(" ")).toMatch(/street momentum/i);
    expect(up.drivers.join(" ")).toMatch(/drift/i);
    const down = buildHouseCall({ ...base, street: { read: "deteriorating", peadActive: true, peadDirection: "down" } });
    expect(down.score).toBe(-1);
    const flat = buildHouseCall({ ...base, street: { read: "flat", peadActive: false, peadDirection: null } });
    expect(flat.score).toBe(0);
  });
});
