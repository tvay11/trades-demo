import type { ScorecardRow } from "./types";

type Bar = { date: string; close: number };

const ret = (later: number, earlier: number) => (later / earlier - 1) * 100;

/** Momentum scorecard rows. All need ≥252 bars (12 months). RS row also needs
 * a benchmark with ≥63 bars. Rows are omitted (not NEUTRAL) when uncomputable. */
export function momentumRows(bars: Bar[], benchmark: Bar[] | null): ScorecardRow[] {
  if (bars.length < 252) return [];
  const rows: ScorecardRow[] = [];
  const close = (arr: Bar[], fromEnd: number) => arr[arr.length - fromEnd].close;
  const last = close(bars, 1);

  // 12-1 momentum: skip the most recent month (21 bars) per the standard factor definition
  const mom = ret(close(bars, 21), close(bars, 252));
  rows.push({
    label: "12-1 momentum",
    value: `${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%`,
    signal: mom > 10 ? "BULL" : mom < -10 ? "BEAR" : "NEUTRAL",
  });

  const high52 = Math.max(...bars.slice(-252).map((b) => b.close));
  const dist = ret(last, high52); // ≤ 0
  rows.push({
    label: "52w high distance",
    value: `${dist.toFixed(1)}%`,
    signal: dist >= -5 ? "BULL" : dist <= -25 ? "BEAR" : "NEUTRAL",
  });

  if (benchmark && benchmark.length >= 63 && bars.length >= 63) {
    const rs = ret(last, close(bars, 63)) - ret(close(benchmark, 1), close(benchmark, 63));
    rows.push({
      label: "RS vs SPY (3m)",
      value: `${rs >= 0 ? "+" : ""}${rs.toFixed(1)}pp`,
      signal: rs > 5 ? "BULL" : rs < -5 ? "BEAR" : "NEUTRAL",
    });
  }
  return rows;
}
