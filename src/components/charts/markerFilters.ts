import type { TradeOverlay } from "./TickerPriceChart";

export type MarkerFilterState = {
  showBuy: boolean;
  showSell: boolean;
  showOther: boolean;
  showD: boolean;
  showR: boolean;
  showI: boolean;
  minDollar: number;
};

export const DEFAULT_FILTERS: MarkerFilterState = {
  showBuy: true,
  showSell: true,
  showOther: true,
  showD: true,
  showR: true,
  showI: true,
  minDollar: 0,
};

export const MIN_DOLLAR_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 1_000, label: "$1k+" },
  { value: 15_000, label: "$15k+" },
  { value: 50_000, label: "$50k+" },
  { value: 100_000, label: "$100k+" },
  { value: 500_000, label: "$500k+" },
] as const;

export function applyMarkerFilters(
  trades: TradeOverlay[],
  f: MarkerFilterState,
): TradeOverlay[] {
  return trades.filter((t) => {
    if (t.type === "buy" && !f.showBuy) return false;
    if (t.type === "sell" && !f.showSell) return false;
    if (t.type === "other" && !f.showOther) return false;
    const party = t.party === "D" ? "D" : t.party === "R" ? "R" : "I";
    if (party === "D" && !f.showD) return false;
    if (party === "R" && !f.showR) return false;
    if (party === "I" && !f.showI) return false;
    if (t.minimum < f.minDollar) return false;
    return true;
  });
}
