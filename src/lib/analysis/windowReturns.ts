export interface PriceRow {
  date: Date;
  close: number;
}

export type TradeSide = "long" | "short";

/** First row whose date is on/after `date`. Rows must be ascending by date. */
export function closeOnOrAfter(date: Date, rows: PriceRow[]): PriceRow | null {
  for (const row of rows) {
    if (row.date.getTime() >= date.getTime()) return row;
  }
  return null;
}

export function windowReturnPct(
  start: Date,
  horizonDays: number,
  rows: PriceRow[],
): { entry: PriceRow; exit: PriceRow; pct: number } | null {
  const entry = closeOnOrAfter(start, rows);
  const exitDate = new Date(start);
  exitDate.setUTCDate(exitDate.getUTCDate() + horizonDays);
  const exit = closeOnOrAfter(exitDate, rows);
  if (!entry || !exit || entry.close <= 0) return null;
  return { entry, exit, pct: ((exit.close - entry.close) / entry.close) * 100 };
}

/** Directional excess return vs a benchmark. Positive = the trade "worked" net of market. */
export function excessReturnPct(
  side: TradeSide,
  start: Date,
  horizonDays: number,
  tickerRows: PriceRow[],
  benchRows: PriceRow[],
): { tickerPct: number; benchPct: number; excessPct: number; win: boolean } | null {
  const t = windowReturnPct(start, horizonDays, tickerRows);
  const b = windowReturnPct(start, horizonDays, benchRows);
  if (!t || !b) return null;
  const excessPct = side === "long" ? t.pct - b.pct : b.pct - t.pct;
  return { tickerPct: t.pct, benchPct: b.pct, excessPct, win: excessPct > 0 };
}
