import type { UTCTimestamp } from "lightweight-charts";

import type { ForecastPoint } from "@/lib/queries/priceForecast";

export type LinePoint = { time: UTCTimestamp; value: number };

export type ForecastSeries = {
  median: LinePoint[];
  lower: LinePoint[];
  upper: LinePoint[];
};

const toTime = (iso: string): UTCTimestamp =>
  (Date.parse(`${iso}T00:00:00Z`) / 1000) as UTCTimestamp;

/**
 * Build median/lower/upper line series for the forecast chart. Each series is
 * anchored to the last real close (so the dashed lines visually connect to the
 * history tail), followed by the forecast points.
 *
 * Forecast points on or before the anchor date are dropped: a forecast is
 * generated from the last cached bar at run time, but the chart's history tail
 * can later extend past that (the price cache keeps fetching newer bars), which
 * would otherwise leave forecast points sitting *before* the anchor and break
 * lightweight-charts' strict ascending-time ordering. Returns empty series when
 * there are no forecast points after the anchor.
 */
export function buildForecastSeries(
  anchor: { date: string; close: number },
  points: ForecastPoint[],
): ForecastSeries {
  const anchorTime = toTime(anchor.date);
  const future = points
    .map((p) => ({ time: toTime(p.date), close: p.close, lower: p.lower, upper: p.upper }))
    .filter((p) => p.time > anchorTime)
    .sort((a, b) => a.time - b.time);

  if (future.length === 0) return { median: [], lower: [], upper: [] };

  const start: LinePoint = { time: anchorTime, value: anchor.close };

  return {
    median: [start, ...future.map((p) => ({ time: p.time, value: p.close }))],
    lower: [start, ...future.map((p) => ({ time: p.time, value: p.lower }))],
    upper: [start, ...future.map((p) => ({ time: p.time, value: p.upper }))],
  };
}
