import { describe, expect, it } from "vitest";
import { applyMarkerFilters, type MarkerFilterState } from "./markerFilters";
import type { TradeOverlay } from "./TickerPriceChart";

const baseTrade = (over: Partial<TradeOverlay>): TradeOverlay => ({
  date: "2026-05-01",
  disclosureDate: "2026-05-15",
  type: "buy",
  transactionType: "Purchase",
  minimum: 15_001,
  amountRangeRaw: "$15,001 - $50,000",
  politicianName: "Test",
  party: "D",
  ticker: "NVDA",
  close: 100,
  ...over,
});

const allOn: MarkerFilterState = {
  showBuy: true,
  showSell: true,
  showOther: true,
  showD: true,
  showR: true,
  showI: true,
  minDollar: 0,
};

describe("applyMarkerFilters", () => {
  it("keeps everything when all toggles are on and min is 0", () => {
    const trades = [
      baseTrade({ type: "buy" }),
      baseTrade({ type: "sell" }),
      baseTrade({ type: "other" }),
    ];
    expect(applyMarkerFilters(trades, allOn)).toHaveLength(3);
  });

  it("filters by side toggle", () => {
    const trades = [baseTrade({ type: "buy" }), baseTrade({ type: "sell" })];
    expect(applyMarkerFilters(trades, { ...allOn, showSell: false })).toHaveLength(1);
    expect(
      applyMarkerFilters(trades, { ...allOn, showSell: false })[0].type,
    ).toBe("buy");
  });

  it("filters by minimum disclosed dollar threshold", () => {
    const trades = [
      baseTrade({ minimum: 1_000 }),
      baseTrade({ minimum: 50_001 }),
      baseTrade({ minimum: 200_000 }),
    ];
    expect(
      applyMarkerFilters(trades, { ...allOn, minDollar: 50_000 }),
    ).toHaveLength(2);
  });

  it("filters by party (treating unknown/null party as I)", () => {
    const trades = [
      baseTrade({ party: "D" }),
      baseTrade({ party: "R" }),
      baseTrade({ party: null }),
    ];
    expect(applyMarkerFilters(trades, { ...allOn, showI: false })).toHaveLength(2);
    expect(
      applyMarkerFilters(trades, { ...allOn, showD: false, showR: false }),
    ).toHaveLength(1);
  });
});
