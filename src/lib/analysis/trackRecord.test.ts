// @vitest-environment node
import { describe, expect, it } from "vitest";
import { aggregateTrackRecords, type TradeOutcome } from "./trackRecord";

const outcome = (politician: string, excess30: number | null, excess90: number | null): TradeOutcome => ({
  politician,
  excess30,
  excess90,
});

describe("aggregateTrackRecords", () => {
  it("aggregates samples, hit rate, and averages per politician", () => {
    const rows = aggregateTrackRecords([
      outcome("A", 10, 12),
      outcome("A", -2, 1),
      outcome("A", 4, null),
      outcome("B", -1, -3),
    ]);
    const a = rows.find((r) => r.politician === "A")!;
    expect(a.samples).toBe(3);
    expect(a.hitRate30).toBeCloseTo((2 / 3) * 100, 5);
    expect(a.avgExcess30).toBeCloseTo(4, 5);
    expect(a.avgExcess90).toBeCloseTo(6.5, 5); // null excluded from the 90d average
  });

  it("skips outcomes with null excess30 entirely for samples", () => {
    const rows = aggregateTrackRecords([outcome("C", null, 5)]);
    expect(rows).toHaveLength(0);
  });
});
