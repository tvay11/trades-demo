import { describe, expect, it } from "vitest";

import { shapeForecast, type PriceForecastRow } from "./priceForecast";

function row(overrides: Partial<PriceForecastRow>): PriceForecastRow {
  return {
    ticker: "NVDA",
    predDate: "2026-06-01T00:00:00.000+00:00",
    close: 10000,
    lower: 9500,
    upper: 10500,
    generatedAt: "2026-05-31T00:00:00.000+00:00",
    model: "Kronos-base",
    sampleCount: 100,
    horizonDays: 30,
    ...overrides,
  };
}

describe("shapeForecast", () => {
  it("returns null when there are no rows", () => {
    expect(shapeForecast([])).toBeNull();
  });

  it("keeps only the latest generatedAt batch and converts cents to dollars", () => {
    const older = "2026-05-30T00:00:00.000+00:00";
    const newer = "2026-05-31T00:00:00.000+00:00";
    const result = shapeForecast([
      row({ generatedAt: older, predDate: "2026-06-01T00:00:00.000+00:00", close: 1 }),
      row({ generatedAt: newer, predDate: "2026-06-02T00:00:00.000+00:00", close: 20000, lower: 19000, upper: 21000 }),
      row({ generatedAt: newer, predDate: "2026-06-01T00:00:00.000+00:00", close: 10000, lower: 9500, upper: 10500 }),
    ]);
    expect(result).not.toBeNull();
    // only the 2 newer-batch points, sorted ascending by predDate
    expect(result!.points.map((p) => p.date)).toEqual(["2026-06-01", "2026-06-02"]);
    expect(result!.points[0]).toEqual({ date: "2026-06-01", close: 100, lower: 95, upper: 105 });
    expect(result!.points[1].close).toBe(200);
    expect(result!.meta).toEqual({
      model: "Kronos-base",
      sampleCount: 100,
      horizonDays: 30,
      generatedAt: "2026-05-31",
      probUp: null,
      expectedMovePct: null,
    });
  });

  it("tolerates date-only and microsecond datetime strings", () => {
    const result = shapeForecast([
      // date-only predDate + microsecond generatedAt — what the old Colab script wrote
      row({ predDate: "2026-07-10", generatedAt: "2026-05-31T18:13:10.738905+00:00" }),
    ]);
    expect(result).not.toBeNull();
    expect(result!.points[0].date).toBe("2026-07-10");
    expect(result!.meta.generatedAt).toBe("2026-05-31");
  });
});
