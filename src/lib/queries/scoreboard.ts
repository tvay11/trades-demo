import type { ConvictionComponent } from "@/lib/analysis/convictionScore";
import { getTickerConviction } from "@/lib/queries/conviction";
import { getLongShortAnalysis } from "@/lib/queries/marketSignalData";

export type Agreement = "agree" | "conflict" | "mixed";

export interface ScoreboardRow {
  ticker: string;
  conviction: number | null;
  convictionSide: "long" | "short" | null;
  breakdown: ConvictionComponent[];
  scannerScore: number;
  scannerStance: "Long" | "Short" | "Neutral";
  agreement: Agreement;
}

interface CandidateInput {
  ticker: string;
  stance: "Long" | "Short" | "Neutral";
  score: number;
}

interface ConvictionInput {
  score: number;
  side: "long" | "short";
  breakdown: ConvictionComponent[];
}

function computeAgreement(
  side: "long" | "short" | null,
  stance: "Long" | "Short" | "Neutral",
): Agreement {
  if (side == null || stance === "Neutral") return "mixed";
  return (stance === "Long") === (side === "long") ? "agree" : "conflict";
}

/** Join scanner candidates with conviction, flag agreement, rank by conviction (nulls last). */
export function buildScoreboardRows(
  candidates: CandidateInput[],
  convictionMap: Map<string, ConvictionInput>,
  limit = 40,
): ScoreboardRow[] {
  const rows: ScoreboardRow[] = candidates.map((c) => {
    const conv = convictionMap.get(c.ticker) ?? null;
    const convictionSide = conv?.side ?? null;
    return {
      ticker: c.ticker,
      conviction: conv?.score ?? null,
      convictionSide,
      breakdown: conv?.breakdown ?? [],
      scannerScore: c.score,
      scannerStance: c.stance,
      agreement: computeAgreement(convictionSide, c.stance),
    };
  });

  rows.sort((a, b) => {
    const ca = a.conviction ?? -1;
    const cb = b.conviction ?? -1;
    if (cb !== ca) return cb - ca;
    return b.scannerScore - a.scannerScore;
  });

  return rows.slice(0, limit);
}

/** Assemble the leaderboard from the scanner candidates + their conviction. Never throws. */
export async function getScoreboard(limit = 40): Promise<ScoreboardRow[]> {
  try {
    const analysis = await getLongShortAnalysis();
    const candidates = analysis.all;
    if (candidates.length === 0) return [];
    const convictionMap = await getTickerConviction(candidates.map((c) => c.ticker));
    return buildScoreboardRows(candidates, convictionMap, limit);
  } catch {
    return [];
  }
}
