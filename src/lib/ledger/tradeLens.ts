import { formatProb } from "./formatProb";
import type { ForecastSummary, OptionsSignal, TradeLens, TradeEdge, TradeBias } from "./types";

/** Pure: append IV-rank cheap/rich context to a trade lens note when rank is extreme.
 * Exported so generateReport can call it after computing ivRankPct post-buildLedger. */
export function appendIvRankNote(note: string, ivRankPct: number): string {
  if (ivRankPct < 25) {
    return note + ` IV rank ${ivRankPct}% — premium cheap vs this name's history.`;
  }
  if (ivRankPct > 75) {
    return note + ` IV rank ${ivRankPct}% — premium rich vs this name's history.`;
  }
  return note;
}

export function buildTradeLens(
  forecast: Pick<ForecastSummary, "probUp" | "expectedMovePct" | "suspect"> | null,
  options: Pick<OptionsSignal, "expectedMovePct" | "expectedMove60dPct" | "atmIvPct"> | null,
  wsbCrowded?: boolean,
): TradeLens {
  const probUp = forecast?.probUp ?? null;
  const kronosMovePct = forecast?.expectedMovePct != null ? Math.abs(forecast.expectedMovePct) : null;
  // Prefer the ~60d implied move to match the 60d forecast horizon; fall back to the near-term expiry move
  const impliedMovePct = options?.expectedMove60dPct ?? options?.expectedMovePct ?? null;

  if (forecast?.suspect) {
    return {
      probUp, kronosMovePct, impliedMovePct,
      edge: "unknown", edgeRatio: null, bias: "neutral / spreads",
      note: "⚠ Forecast flagged suspect — do not trade this signal. " +
        (impliedMovePct != null ? `Options imply ±${impliedMovePct.toFixed(1)}%; the model number is unreliable here. ` : "") +
        "Research only — not financial advice." +
        (wsbCrowded ? " ⚠ Retail-crowded name — IV likely pumped; long premium is expensive." : ""),
    };
  }

  let edge: TradeEdge = "unknown";
  let edgeRatio: number | null = null;
  if (kronosMovePct != null && impliedMovePct != null && impliedMovePct > 0) {
    edgeRatio = kronosMovePct / impliedMovePct;
    edge = edgeRatio > 1.2 ? "cheap" : edgeRatio < 0.8 ? "rich" : "fair";
  }

  const dir = probUp == null ? "flat" : probUp >= 60 ? "up" : probUp <= 40 ? "down" : "flat";
  let bias: TradeBias;
  if (dir === "flat") bias = "neutral / spreads";
  else if (edge === "rich") bias = dir === "up" ? "call spreads" : "put spreads";
  else bias = dir === "up" ? "long calls" : "long puts"; // cheap/fair/unknown → directional premium

  const edgeText =
    edge === "cheap" ? "the forecast expects a bigger move than options are pricing — premium looks relatively cheap"
    : edge === "rich" ? "options are pricing a bigger move than the forecast — premium looks rich (favor spreads)"
    : edge === "fair" ? "forecast and option-implied moves are roughly in line"
    : "not enough data to compare forecast vs implied move";
  const note = `${probUp != null ? `P(up) ${formatProb(probUp)} → ${dir === "up" ? "upside" : dir === "down" ? "downside" : "no clear direction"}; ` : ""}${edgeText}. Research only — not financial advice.` +
    (wsbCrowded ? " ⚠ Retail-crowded name — IV likely pumped; long premium is expensive." : "");

  return { probUp, kronosMovePct, impliedMovePct, edge, edgeRatio, bias, note };
}
