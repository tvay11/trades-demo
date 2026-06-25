import { describe, expect, it } from "vitest";

import { computePead, computeStreetRead, shapeStreetMomentum } from "./streetMomentum";

const trend = [
  {
    period: "0q",
    epsRevisions: { upLast30days: 5, downLast30days: 1 },
    epsTrend: { current: 1.2, "30daysAgo": 1.1, "60daysAgo": 1.05, "90daysAgo": 1.0 },
  },
  {
    period: "0y",
    epsRevisions: { upLast30days: 8, downLast30days: 2 },
    epsTrend: { current: 5.0, "30daysAgo": 4.8, "60daysAgo": 4.7, "90daysAgo": 4.5 },
  },
];

const history = [
  { quarter: new Date("2026-03-31"), epsActual: 1.3, epsEstimate: 1.1, surprisePercent: 0.182 },
  { quarter: new Date("2025-12-31"), epsActual: 1.0, epsEstimate: 1.05, surprisePercent: -0.048 },
];

const actions = [
  { epochGradeDate: new Date("2026-06-01"), firm: "GS", toGrade: "Buy", fromGrade: "Hold", action: "up" },
  { epochGradeDate: new Date("2026-05-20"), firm: "MS", toGrade: "Sell", fromGrade: "Hold", action: "down" },
  { epochGradeDate: new Date("2025-01-01"), firm: "Old", toGrade: "Buy", fromGrade: null, action: "up" }, // >90d, dropped
];

describe("shapeStreetMomentum", () => {
  it("shapes revisions, trends, surprises (as %), and 90d-filtered actions", () => {
    const sm = shapeStreetMomentum({ trend, history, actions, nextEarningsDaysUntil: 45, now: new Date("2026-06-10") });
    expect(sm.revisions).toEqual([
      { period: "0q", up30: 5, down30: 1 },
      { period: "0y", up30: 8, down30: 2 },
    ]);
    expect(sm.trendDeltas[0].pctChange30d).toBeCloseTo(9.09, 1); // 1.2/1.1
    expect(sm.surprises[0]).toMatchObject({ quarter: "2026-03-31", surprisePct: 18.2 });
    expect(sm.beatCount).toBe(1);
    expect(sm.surpriseTotal).toBe(2);
    expect(sm.upgrades30).toBe(1);
    expect(sm.downgrades30).toBe(1);
    expect(sm.recentActions).toHaveLength(2);
    expect(sm.read).toBe("improving");
  });

  it("returns null trend delta when baseline is ~zero", () => {
    const sm = shapeStreetMomentum({
      trend: [{ period: "0q", epsRevisions: {}, epsTrend: { current: 0.5, "30daysAgo": 0.005 } }],
      history: [], actions: [], nextEarningsDaysUntil: null, now: new Date("2026-06-10"),
    });
    expect(sm.trendDeltas[0].pctChange30d).toBeNull();
    expect(sm.read).toBe("unknown");
  });
});

describe("computeStreetRead", () => {
  it("improving needs vote sum >= 2", () => {
    expect(computeStreetRead({ revisionsNet: 10, trendPct: 9, actionsNet: 0 })).toBe("improving");
  });
  it("deteriorating at vote sum <= -2", () => {
    expect(computeStreetRead({ revisionsNet: -3, trendPct: -2, actionsNet: -1 })).toBe("deteriorating");
  });
  it("flat when mixed", () => {
    expect(computeStreetRead({ revisionsNet: 2, trendPct: -3, actionsNet: 0 })).toBe("flat");
  });
  it("unknown when no facts", () => {
    expect(computeStreetRead({ revisionsNet: null, trendPct: null, actionsNet: null })).toBe("unknown");
  });
});

describe("computePead", () => {
  it("active inside ~75d of report with |surprise| >= 5", () => {
    // nextEarnings in 45d -> daysSince ≈ 91-45 = 46
    expect(computePead(18.2, 45, null, new Date("2026-06-10"))).toEqual({
      active: true, daysSinceReport: 46, lastSurprisePct: 18.2, direction: "up",
    });
  });
  it("inactive on small surprise", () => {
    expect(computePead(2, 45, null, new Date("2026-06-10")).active).toBe(false);
  });
  it("falls back to quarter-end + 30d when no next-earnings date", () => {
    const p = computePead(-9, null, new Date("2026-04-30"), new Date("2026-06-10"));
    // quarter end Apr 30 + 30d ≈ May 30 report; ~11 days since
    expect(p.active).toBe(true);
    expect(p.direction).toBe("down");
    expect(p.daysSinceReport).toBe(11);
  });
  it("inactive when window stale (> 75d)", () => {
    expect(computePead(20, null, new Date("2025-12-31"), new Date("2026-06-10")).active).toBe(false);
  });
});
