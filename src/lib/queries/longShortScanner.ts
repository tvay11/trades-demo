import type { LongShortCandidate } from "./marketSignals";

export type LongShortScannerCandidate = LongShortCandidate;

export type LongShortScannerSummary = {
  longCount: number;
  shortCount: number;
  balancedCount: number;
  netFlow: number;
  insiderConfirmedCount: number;
  averageLagDays: number;
};

export type LongShortScannerGroup = {
  title: "Long Flow" | "Short Flow" | "Balanced / Watchlist";
  subtitle: string;
  candidates: LongShortScannerCandidate[];
  tone: "positive" | "negative" | "neutral";
  empty: string;
};

export function buildLongShortSummary(
  candidates: LongShortScannerCandidate[],
): LongShortScannerSummary {
  const longCount = candidates.filter((candidate) => candidate.stance === "Long").length;
  const shortCount = candidates.filter((candidate) => candidate.stance === "Short").length;
  const balancedCount = candidates.length - longCount - shortCount;
  const netFlow = candidates.reduce((total, candidate) => total + candidate.netFlow, 0);
  const insiderConfirmedCount = candidates.filter(
    (candidate) =>
      candidate.netFlow !== 0 &&
      candidate.insiderNetValue !== 0 &&
      Math.sign(candidate.netFlow) === Math.sign(candidate.insiderNetValue),
  ).length;
  const lagValues = candidates
    .map((candidate) => candidate.averageDisclosureLagDays)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const averageLagDays = lagValues.length
    ? Math.round(lagValues.reduce((total, value) => total + value, 0) / lagValues.length)
    : 0;

  return {
    longCount,
    shortCount,
    balancedCount,
    netFlow,
    insiderConfirmedCount,
    averageLagDays,
  };
}

export function buildLongShortScannerGroups(
  candidates: LongShortScannerCandidate[],
): LongShortScannerGroup[] {
  return [
    {
      title: "Long Flow",
      subtitle: "Tickers where disclosed buying pressure is larger than disclosed selling pressure.",
      candidates: candidates.filter((candidate) => candidate.stance === "Long"),
      tone: "positive",
      empty: "No net-long tickers in the current disclosure window.",
    },
    {
      title: "Short Flow",
      subtitle: "Tickers where disclosed selling pressure is larger than disclosed buying pressure.",
      candidates: candidates.filter((candidate) => candidate.stance === "Short"),
      tone: "negative",
      empty: "No net-short tickers in the current disclosure window.",
    },
    {
      title: "Balanced / Watchlist",
      subtitle: "Tickers with mixed or neutral disclosed flow worth monitoring.",
      candidates: candidates.filter((candidate) => candidate.stance === "Neutral"),
      tone: "neutral",
      empty: "No balanced tickers in the current disclosure window.",
    },
  ];
}
