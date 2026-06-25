import { describe, expect, it } from "vitest";

import { shapeDarkShort, shapeGovContracts, shapeThirteenF, shapeWsb } from "./altFlow";

describe("shapeWsb", () => {
  it("computes 7d windows, surge ratio, and crowding", () => {
    const now = new Date("2026-06-10");
    const rows = [
      { date: new Date("2026-06-09"), mentions: 250, sentiment: 0.4 },
      { date: new Date("2026-06-05"), mentions: 100, sentiment: 0.1 },
      { date: new Date("2026-05-30"), mentions: 50, sentiment: null },
    ];
    const w = shapeWsb(rows, now)!;
    expect(w.mentions7d).toBe(350);
    expect(w.mentionsPrior7d).toBe(50);
    expect(w.surgeRatio).toBe(7);
    expect(w.latestSentiment).toBe(0.4);
    expect(w.crowded).toBe(true); // 350 >= 300 && 7 >= 3
  });
  it("null on empty", () => expect(shapeWsb([], new Date())).toBeNull());
});

describe("shapeDarkShort", () => {
  it("needs >= 5 samples for excess", () => {
    const rows = [55, 50].map((p, i) => ({ date: new Date(2026, 5, 9 - i), shortVolumePercent: p }));
    const d = shapeDarkShort(rows)!;
    expect(d.latestShortVolPct).toBe(55);
    expect(d.excessPp).toBeNull();
    expect(d.sampleSize).toBe(2);
  });
  it("excess = latest - avg(prior up to 20)", () => {
    const rows = [62, 50, 50, 50, 50, 50].map((p, i) => ({ date: new Date(2026, 5, 9 - i), shortVolumePercent: p }));
    expect(shapeDarkShort(rows)!.excessPp).toBe(12);
  });
});

describe("shapeThirteenF", () => {
  it("sums changeShares at the latest reportDate and ranks holders", () => {
    const rows = [
      { filer: "A", changeShares: 100, valueCents: 500_000n, reportDate: new Date("2026-03-31") },
      { filer: "B", changeShares: -40, valueCents: 900_000n, reportDate: new Date("2026-03-31") },
      { filer: "C", changeShares: 999, valueCents: 100n, reportDate: new Date("2025-12-31") }, // older period ignored
    ];
    const t = shapeThirteenF(rows)!;
    expect(t.netChangeShares).toBe(60);
    expect(t.holderCount).toBe(2);
    expect(t.topHolders[0].filer).toBe("B");
    expect(t.reportDate).toBe("2026-03-31");
  });
});

describe("shapeGovContracts", () => {
  it("aggregates 180d and lists recent", () => {
    const now = new Date("2026-06-10");
    const rows = [
      { agency: "DoD", amountCents: 1_000_000_00n, awardedAt: new Date("2026-05-01") },
      { agency: "DoE", amountCents: 250_000_00n, awardedAt: new Date("2026-01-15") },
      { agency: "Old", amountCents: 9_000_000_00n, awardedAt: new Date("2025-01-01") }, // > 180d, excluded
    ];
    const g = shapeGovContracts(rows, now)!;
    expect(g.count180d).toBe(2);
    expect(g.totalUsd180d).toBe(1_250_000);
    expect(g.recent[0].agency).toBe("DoD");
  });
});
