// @vitest-environment node
import { describe, expect, it } from "vitest";
import { scoreTrade, type ConvictionInput } from "./convictionScore";

const base: ConvictionInput = {
  side: "long",
  daysSinceDisclosure: 2,
  amountMinDollars: 300_000,
  trackRecord: { samples: 10, hitRate30: 65, avgExcess30: 6 },
  committeeLinked: true,
  dualInsiderConfirmed: true,
  darkFlowExcessPp: -8,
};

describe("scoreTrade", () => {
  it("scores a maximal setup at 100", () => {
    const r = scoreTrade({ ...base, amountMinDollars: 1_500_000 });
    expect(r.score).toBe(100);
    expect(r.breakdown).toHaveLength(6);
    expect(r.breakdown.reduce((s, c) => s + c.pts, 0)).toBe(100);
  });

  it("uses neutral track-record points below 5 samples", () => {
    const r = scoreTrade({ ...base, trackRecord: { samples: 3, hitRate30: 100, avgExcess30: 50 } });
    expect(r.breakdown.find((c) => c.label === "Track record")!.pts).toBe(8);
  });

  it("missing track record is neutral 8", () => {
    const r = scoreTrade({ ...base, trackRecord: null });
    expect(r.breakdown.find((c) => c.label === "Track record")!.pts).toBe(8);
  });

  it("dark flow only counts when aligned with the side", () => {
    expect(scoreTrade({ ...base, side: "long", darkFlowExcessPp: 8 }).breakdown.find((c) => c.label === "Dark flow")!.pts).toBe(0);
    expect(scoreTrade({ ...base, side: "short", darkFlowExcessPp: 8 }).breakdown.find((c) => c.label === "Dark flow")!.pts).toBe(10);
  });

  it("decays recency and size", () => {
    const stale = scoreTrade({ ...base, daysSinceDisclosure: 45, amountMinDollars: 5_000 });
    expect(stale.breakdown.find((c) => c.label === "Recency")!.pts).toBe(2);
    expect(stale.breakdown.find((c) => c.label === "Size")!.pts).toBe(2);
  });

  it("track-record cap holds at 30", () => {
    const r = scoreTrade({ ...base, trackRecord: { samples: 20, hitRate30: 70, avgExcess30: 9 } });
    expect(r.breakdown.find((c) => c.label === "Track record")!.pts).toBe(30);
  });
});
