// @vitest-environment node

import { describe, expect, it } from "vitest";
import { evaluateForecastRuns } from "./forecastTrackRecord";

// 10 daily bars: 2026-01-02 through 2026-01-13 (skip weekends for realism but let's
// keep it simple with consecutive dates so tests are easy to reason about).
function makeBar(date: string, close: number) {
  return { date, close };
}

const BARS = [
  makeBar("2026-01-02", 100),
  makeBar("2026-01-03", 101),
  makeBar("2026-01-04", 102),
  makeBar("2026-01-05", 103),
  makeBar("2026-01-06", 104),
  makeBar("2026-01-07", 105),
  makeBar("2026-01-08", 106),
  makeBar("2026-01-09", 107),
  makeBar("2026-01-10", 108),
  makeBar("2026-01-11", 110),
];

describe("evaluateForecastRuns", () => {
  it("empty input returns empty track record with null aggregates", () => {
    const result = evaluateForecastRuns([], BARS);
    expect(result.n).toBe(0);
    expect(result.runs).toHaveLength(0);
    expect(result.hitRate).toBeNull();
    expect(result.medianAbsErrPct).toBeNull();
    expect(result.bandCoveragePct).toBeNull();
  });

  it("skips runs that don't have >= 5 elapsed bars", () => {
    // generatedAt on 2026-01-09 leaves only bars 2026-01-10 and 2026-01-11 (2 bars after)
    const runs = [
      {
        generatedAt: "2026-01-09",
        horizonDays: 30,
        points: [{ predDate: "2026-01-11", close: 108, lower: 105, upper: 111 }],
      },
    ];
    const result = evaluateForecastRuns(runs, BARS);
    expect(result.n).toBe(0);
    expect(result.runs).toHaveLength(0);
  });

  it("counts a clean direction hit where realized is within band", () => {
    // anchor bar: 2026-01-02 (close=100)
    // eval point: 2026-01-11 (close=110), predicted +10% → close=110, band 105..115
    // realized: +10% exactly → directionHit=true, withinBand=true
    const runs = [
      {
        generatedAt: "2026-01-02",
        horizonDays: 30,
        points: [{ predDate: "2026-01-11", close: 110, lower: 105, upper: 115 }],
      },
    ];
    const result = evaluateForecastRuns(runs, BARS);
    expect(result.n).toBe(1);
    expect(result.runs[0].directionHit).toBe(true);
    expect(result.runs[0].withinBand).toBe(true);
    expect(result.runs[0].predictedChangePct).toBeCloseTo(10, 4);
    expect(result.runs[0].realizedChangePct).toBeCloseTo(10, 4);
    expect(result.hitRate).toBeCloseTo(100, 4);
    expect(result.bandCoveragePct).toBeCloseTo(100, 4);
    expect(result.medianAbsErrPct).toBeCloseTo(0, 4);
  });

  it("counts a direction miss where realized is outside band", () => {
    // anchor bar: 2026-01-02 (close=100)
    // predicted: -5% → close=95, band 90..98 → eval bar 2026-01-11 (close=110 = +10%)
    // direction miss (predicted down, realized up), outside band
    const runs = [
      {
        generatedAt: "2026-01-02",
        horizonDays: 30,
        points: [{ predDate: "2026-01-11", close: 95, lower: 90, upper: 98 }],
      },
    ];
    const result = evaluateForecastRuns(runs, BARS);
    expect(result.n).toBe(1);
    expect(result.runs[0].directionHit).toBe(false);
    expect(result.runs[0].withinBand).toBe(false);
    expect(result.hitRate).toBeCloseTo(0, 4);
    expect(result.bandCoveragePct).toBeCloseTo(0, 4);
  });

  it("median abs error is correct over two runs", () => {
    // Run 1: predicted +10%, realized +10% → err 0
    // Run 2: predicted -5%, realized +10% → err 15
    // median of [0, 15] = 7.5
    const runs = [
      {
        generatedAt: "2026-01-02",
        horizonDays: 30,
        points: [{ predDate: "2026-01-11", close: 110, lower: 105, upper: 115 }],
      },
      {
        generatedAt: "2026-01-02T00:01:00Z", // same anchor bar, slightly different generatedAt
        horizonDays: 30,
        points: [{ predDate: "2026-01-11", close: 95, lower: 90, upper: 98 }],
      },
    ];
    const result = evaluateForecastRuns(runs, BARS);
    expect(result.n).toBe(2);
    expect(result.medianAbsErrPct).toBeCloseTo(7.5, 4);
  });
});
