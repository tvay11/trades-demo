import { applyCacheLife } from "@/lib/cache";
import YahooFinance from "yahoo-finance2";
import type { MacroLean, MacroFactor, MacroRegime } from "@/lib/ledger/types";

// Data sourced from Yahoo Finance (VIX, dollar, treasuries)
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export interface MacroInputs {
  curveBp: number | null;      // (10y - 3mo) in basis points
  hySpreadPct: number | null;  // HY OAS, percent
  vix: number | null;
  dollarChgPct: number | null; // broad dollar % change over ~1mo (or recent)
}

const lean = (x: number): MacroLean => (x > 0.25 ? "risk-on" : x < -0.25 ? "risk-off" : "neutral");

export function scoreMacroRegime(i: MacroInputs): MacroRegime {
  const factors: MacroFactor[] = [];
  let sum = 0, n = 0;
  if (i.curveBp != null) { const s = Math.max(-1, Math.min(1, i.curveBp / 100)); sum += s; n++;
    factors.push({ name: "Yield curve (10y−3mo)", value: `${i.curveBp.toFixed(0)} bp`, lean: lean(s) }); }
  if (i.hySpreadPct != null) { const s = Math.max(-1, Math.min(1, (4.5 - i.hySpreadPct) / 2)); sum += s; n++;
    factors.push({ name: "HY credit spread", value: `${i.hySpreadPct.toFixed(2)}%`, lean: lean(s) }); }
  if (i.vix != null) { const s = Math.max(-1, Math.min(1, (18 - i.vix) / 10)); sum += s; n++;
    factors.push({ name: "VIX", value: i.vix.toFixed(1), lean: lean(s) }); }
  if (i.dollarChgPct != null) { const s = Math.max(-1, Math.min(1, -i.dollarChgPct / 3)); sum += s; n++;
    factors.push({ name: "US dollar (trend)", value: `${i.dollarChgPct >= 0 ? "+" : ""}${i.dollarChgPct.toFixed(1)}%`, lean: lean(s) }); }
  const score = n ? Math.round((sum / n) * 100) : 0;
  const label = lean(score / 100);
  const confidence: "low" | "ok" = factors.length >= 2 ? "ok" : "low";
  const baseNote = n === 0 ? "Macro data unavailable."
    : `Cross-asset backdrop is ${label} (${factors.filter(f => f.lean === label).map(f => f.name).join(", ") || "mixed"}).`;
  const note = confidence === "low" && n > 0 ? `${baseNote} (partial data)` : baseNote;
  return { asOf: new Date().toISOString().slice(0, 10), score, label, factors, note, confidence };
}

type YahooClose = { close: number | null };

async function fetchYahooCloses(symbol: string, days: number): Promise<number[]> {
  try {
    const period2 = new Date();
    const period1 = new Date(period2.getTime() - days * 24 * 60 * 60 * 1000);
    const result = (await yf.chart(symbol, { period1, period2, interval: "1d" })) as { quotes: YahooClose[] };
    return result.quotes.map(q => q.close).filter((v): v is number => v != null && Number.isFinite(v));
  } catch (e) {
    console.warn(`[macro] ${symbol} fetch failed: ${(e as Error).message}`);
    return [];
  }
}

const lastVal = (closes: number[]) => closes.length ? closes[closes.length - 1] : null;

export async function getMacroRegime(): Promise<MacroRegime | null> {
  "use cache";
  applyCacheLife("hours");
  try {
    // ^TNX = 10-year Treasury yield (percent), ^IRX = 13-week T-bill yield (percent)
    // ^VIX = CBOE Volatility Index, DX-Y.NYB = US Dollar Index
    const [tnx, irx, vix, dxy] = await Promise.all([
      fetchYahooCloses("^TNX", 40),
      fetchYahooCloses("^IRX", 40),
      fetchYahooCloses("^VIX", 40),
      fetchYahooCloses("DX-Y.NYB", 40),
    ]);

    // TNX and IRX are in percent (e.g. 4.54 = 4.54%) — multiply difference by 100 → basis points
    const curveBp = lastVal(tnx) != null && lastVal(irx) != null
      ? (lastVal(tnx)! - lastVal(irx)!) * 100
      : null;

    // Dollar % change over ~22 trading days (~1 month)
    const dollarChgPct = dxy.length > 22
      ? (dxy[dxy.length - 1] / dxy[dxy.length - 22] - 1) * 100
      : null;

    // hySpreadPct dropped (FRED-only); 3 remaining factors satisfy ≥2 confidence gate
    return scoreMacroRegime({ curveBp, hySpreadPct: null, vix: lastVal(vix), dollarChgPct });
  } catch (e) {
    console.warn(`[macro] getMacroRegime failed: ${(e as Error).message}`);
    return null;
  }
}
