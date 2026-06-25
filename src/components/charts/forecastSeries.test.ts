import { describe, expect, it } from "vitest";

import { buildForecastSeries } from "./forecastSeries";
import type { ForecastPoint } from "@/lib/queries/priceForecast";

const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 1000;

const points: ForecastPoint[] = [
  { date: "2026-06-01", close: 110, lower: 105, upper: 115 },
  { date: "2026-06-02", close: 112, lower: 104, upper: 120 },
];

describe("buildForecastSeries", () => {
  it("anchors median/lower/upper to the last real close so the line connects", () => {
    const series = buildForecastSeries({ date: "2026-05-29", close: 100 }, points);
    // each series starts with the anchor point (last real close), then the forecast
    expect(series.median[0]).toEqual({ time: toTime("2026-05-29"), value: 100 });
    expect(series.lower[0]).toEqual({ time: toTime("2026-05-29"), value: 100 });
    expect(series.upper[0]).toEqual({ time: toTime("2026-05-29"), value: 100 });
    expect(series.median[1]).toEqual({ time: toTime("2026-06-01"), value: 110 });
    expect(series.upper[2]).toEqual({ time: toTime("2026-06-02"), value: 120 });
    expect(series.median).toHaveLength(3);
  });

  it("returns empty series when there are no points", () => {
    const series = buildForecastSeries({ date: "2026-05-29", close: 100 }, []);
    expect(series.median).toEqual([]);
    expect(series.lower).toEqual([]);
    expect(series.upper).toEqual([]);
  });

  it("drops forecast points on or before the anchor so the series stays ascending", () => {
    // Forecast generated from older data (starts 2026-05-25) but the history
    // tail now ends at 2026-05-29 — the overlap points must be dropped.
    const overlapping: ForecastPoint[] = [
      { date: "2026-05-25", close: 90, lower: 85, upper: 95 },
      { date: "2026-05-28", close: 95, lower: 90, upper: 100 },
      { date: "2026-05-29", close: 98, lower: 93, upper: 103 },
      { date: "2026-06-01", close: 110, lower: 105, upper: 115 },
      { date: "2026-06-02", close: 112, lower: 104, upper: 120 },
    ];
    const series = buildForecastSeries({ date: "2026-05-29", close: 100 }, overlapping);
    // anchor + only the two strictly-after points
    expect(series.median).toEqual([
      { time: toTime("2026-05-29"), value: 100 },
      { time: toTime("2026-06-01"), value: 110 },
      { time: toTime("2026-06-02"), value: 112 },
    ]);
    // strictly ascending times (the invariant lightweight-charts asserts)
    const times = series.median.map((p) => p.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(times.length);
  });
});
