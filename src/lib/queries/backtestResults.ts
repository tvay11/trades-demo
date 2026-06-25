import { readFile } from "node:fs/promises";
import path from "node:path";

export interface SummaryRow {
  horizon: number;
  n: number;
  krMapePct: number;
  rwMapePct: number;
  driftMapePct: number;
  coveragePct: number;
  meanBandWidthPct: number;
}

export interface ResultRow {
  ticker: string;
  cutoff: string;
  horizon: number;
  anchor: number;
  predClose: number;
  p10: number;
  p90: number;
  realClose: number;
  predChangePct: number;
  realChangePct: number;
  krAbsErrPct: number;
  rwAbsErrPct: number;
  driftAbsErrPct: number;
  withinBand: number;
  bandWidthPct: number;
  samples: number;
  temperature: number;
}

export interface TickerHorizonRow {
  ticker: string;
  horizon: number;
  n: number;
  krMapePct: number;
  rwMapePct: number;
  driftMapePct: number;
  coveragePct: number;
}

export interface Verdict {
  totalHorizons: number;
  beatsBaselineHorizons: number;
  beatsBaseline: boolean;
  avgCoveragePct: number;
  coverageState: "under" | "ok" | "over";
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function parseSummaryCsv(text: string): SummaryRow[] {
  const lines = splitLines(text);
  return lines.slice(1).map((line) => {
    const c = line.split(",");
    return {
      horizon: Number(c[0]),
      n: Number(c[1]),
      krMapePct: Number(c[2]),
      rwMapePct: Number(c[3]),
      driftMapePct: Number(c[4]),
      coveragePct: Number(c[5]),
      meanBandWidthPct: Number(c[6]),
    };
  });
}

export function parseResultsCsv(text: string): ResultRow[] {
  const lines = splitLines(text);
  return lines.slice(1).map((line) => {
    const c = line.split(",");
    return {
      ticker: c[0],
      cutoff: c[1],
      horizon: Number(c[2]),
      anchor: Number(c[3]),
      predClose: Number(c[4]),
      p10: Number(c[5]),
      p90: Number(c[6]),
      realClose: Number(c[7]),
      predChangePct: Number(c[8]),
      realChangePct: Number(c[9]),
      krAbsErrPct: Number(c[10]),
      rwAbsErrPct: Number(c[11]),
      driftAbsErrPct: Number(c[12]),
      withinBand: Number(c[13]),
      bandWidthPct: Number(c[14]),
      samples: Number(c[15]),
      temperature: Number(c[16]),
    };
  });
}

export function perTickerByHorizon(rows: ResultRow[]): TickerHorizonRow[] {
  const groups = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const key = `${r.ticker}|${r.horizon}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const out: TickerHorizonRow[] = [];
  for (const [key, list] of groups) {
    const [ticker, horizonStr] = key.split("|");
    const n = list.length;
    const mean = (sel: (r: ResultRow) => number) => list.reduce((s, r) => s + sel(r), 0) / n;
    out.push({
      ticker,
      horizon: Number(horizonStr),
      n,
      krMapePct: mean((r) => r.krAbsErrPct),
      rwMapePct: mean((r) => r.rwAbsErrPct),
      driftMapePct: mean((r) => r.driftAbsErrPct),
      coveragePct: mean((r) => r.withinBand) * 100,
    });
  }
  out.sort((a, b) => (a.ticker === b.ticker ? a.horizon - b.horizon : a.ticker.localeCompare(b.ticker)));
  return out;
}

export function buildVerdict(summary: SummaryRow[]): Verdict {
  const totalHorizons = summary.length;
  const beatsBaselineHorizons = summary.filter(
    (s) => s.krMapePct < Math.min(s.rwMapePct, s.driftMapePct),
  ).length;
  const avgCoveragePct = totalHorizons
    ? summary.reduce((s, r) => s + r.coveragePct, 0) / totalHorizons
    : 0;
  const coverageState: Verdict["coverageState"] =
    avgCoveragePct < 70 ? "under" : avgCoveragePct > 90 ? "over" : "ok";
  return {
    totalHorizons,
    beatsBaselineHorizons,
    beatsBaseline: totalHorizons > 0 && beatsBaselineHorizons === totalHorizons,
    avgCoveragePct,
    coverageState,
  };
}

export interface BacktestData {
  summary: SummaryRow[];
  results: ResultRow[];
  perTicker: TickerHorizonRow[];
  verdict: Verdict;
}

/** Read both committed CSVs from the repo root. Returns null if either is missing. */
export async function getBacktestData(): Promise<BacktestData | null> {
  try {
    const root = process.cwd();
    const [summaryText, resultsText] = await Promise.all([
      readFile(path.join(root, "backtest_summary.csv"), "utf8"),
      readFile(path.join(root, "backtest_results.csv"), "utf8"),
    ]);
    const summary = parseSummaryCsv(summaryText);
    const results = parseResultsCsv(resultsText);
    if (summary.length === 0) return null;
    return { summary, results, perTicker: perTickerByHorizon(results), verdict: buildVerdict(summary) };
  } catch {
    return null;
  }
}
