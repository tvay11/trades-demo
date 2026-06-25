import { describe, it, expect } from "vitest";
import { shapeVolumeOverTime, type VolumeTradeInput } from "./volumeOverTime";

function trade(partial: Partial<VolumeTradeInput>): VolumeTradeInput {
  return {
    date: new Date("2025-09-01T00:00:00Z"),
    amountMin: 1000,
    amountMax: 15000,
    party: "D",
    ...partial,
  };
}

describe("shapeVolumeOverTime", () => {
  it("returns empty array for empty input", () => {
    expect(shapeVolumeOverTime([])).toEqual([]);
  });

  it("buckets a single trade into its ISO week with the minimum", () => {
    // 2025-09-01 is a Monday → ISO week 36 of 2025
    const out = shapeVolumeOverTime([
      trade({ date: new Date("2025-09-01T00:00:00Z"), amountMin: 1000, amountMax: 15000, party: "D" }),
    ]);
    expect(out).toEqual([{ week: "2025-W36", total: 1000, dem: 1000, rep: 0, ind: 0 }]);
  });

  it("aggregates trades in the same week", () => {
    const out = shapeVolumeOverTime([
      trade({ date: new Date("2025-09-01T00:00:00Z"), amountMin: 1000, amountMax: 15000, party: "D" }),
      trade({ date: new Date("2025-09-03T00:00:00Z"), amountMin: 0, amountMax: 1000, party: "R" }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ week: "2025-W36", total: 1000, dem: 1000, rep: 0, ind: 0 });
  });

  it("splits trades across different weeks and sorts ascending", () => {
    const out = shapeVolumeOverTime([
      trade({ date: new Date("2025-09-15T00:00:00Z"), amountMin: 0, amountMax: 1000, party: "D" }), // W38
      trade({ date: new Date("2025-09-01T00:00:00Z"), amountMin: 0, amountMax: 1000, party: "D" }), // W36
    ]);
    expect(out.map((b) => b.week)).toEqual(["2025-W36", "2025-W38"]);
  });

  it("classifies non-D non-R parties (null, I, etc.) as independent", () => {
    const out = shapeVolumeOverTime([
      trade({ date: new Date("2025-09-01T00:00:00Z"), amountMin: 100, amountMax: 1000, party: null }),
      trade({ date: new Date("2025-09-02T00:00:00Z"), amountMin: 200, amountMax: 1000, party: "I" }),
    ]);
    expect(out[0]).toEqual({ week: "2025-W36", total: 300, dem: 0, rep: 0, ind: 300 });
  });

  it("treats null amount bounds as zero contribution", () => {
    const out = shapeVolumeOverTime([
      trade({ date: new Date("2025-09-01T00:00:00Z"), amountMin: null, amountMax: null, party: "D" }),
    ]);
    expect(out[0].total).toBe(0);
  });

  it("uses ISO-year for end-of-year edge cases", () => {
    // 2024-12-30 is Monday of ISO 2025-W01
    const out = shapeVolumeOverTime([
      trade({ date: new Date("2024-12-30T00:00:00Z"), amountMin: 0, amountMax: 1000, party: "D" }),
    ]);
    expect(out[0].week).toBe("2025-W01");
  });
});
