import { describe, it, expect } from "vitest";
import { buildTradeLens, appendIvRankNote } from "./tradeLens";

describe("buildTradeLens", () => {
  it("flags premium cheap + long puts when forecast move exceeds implied and P(up) low", () => {
    const t = buildTradeLens({ probUp: 19, expectedMovePct: -8, suspect: false }, { expectedMovePct: 4, expectedMove60dPct: null, atmIvPct: 50 });
    expect(t.edge).toBe("cheap");        // |−8| vs 4 implied → ratio 2 > 1.2
    expect(t.bias).toBe("long puts");    // P(up) 19 → downside
  });
  it("flags rich + spreads when implied exceeds forecast", () => {
    const t = buildTradeLens({ probUp: 55, expectedMovePct: 2, suspect: false }, { expectedMovePct: 9, expectedMove60dPct: null, atmIvPct: 70 });
    expect(t.edge).toBe("rich");
    expect(t.bias).toBe("neutral / spreads");
  });
  it("handles missing data", () => {
    const t = buildTradeLens(null, null);
    expect(t.edge).toBe("unknown");
    expect(t.bias).toBe("neutral / spreads");
  });

  it("suspect forecast → edge unknown, neutral bias, warning note", () => {
    const lens = buildTradeLens(
      { probUp: 100, expectedMovePct: 78.7, suspect: true },
      { expectedMovePct: 13.6, expectedMove60dPct: 18.6, atmIvPct: 47 },
    );
    expect(lens.edge).toBe("unknown");
    expect(lens.edgeRatio).toBeNull();
    expect(lens.bias).toBe("neutral / spreads");
    expect(lens.note).toMatch(/suspect/i);
  });

  it("appends retail-crowded warning when wsbCrowded is true", () => {
    const lens = buildTradeLens(
      { probUp: 60, expectedMovePct: 5, suspect: false },
      { expectedMovePct: 4, expectedMove60dPct: null, atmIvPct: 40 },
      true,
    );
    expect(lens.note).toMatch(/Retail-crowded/);
  });
});

describe("appendIvRankNote", () => {
  it("appends cheap context when ivRankPct < 25", () => {
    const result = appendIvRankNote("Base note.", 18);
    expect(result).toMatch(/IV rank 18%/);
    expect(result).toMatch(/cheap/);
  });
  it("appends rich context when ivRankPct > 75", () => {
    const result = appendIvRankNote("Base note.", 82);
    expect(result).toMatch(/IV rank 82%/);
    expect(result).toMatch(/rich/);
  });
  it("returns note unchanged when ivRankPct is mid-range", () => {
    expect(appendIvRankNote("Base note.", 50)).toBe("Base note.");
    expect(appendIvRankNote("Base note.", 25)).toBe("Base note.");
    expect(appendIvRankNote("Base note.", 75)).toBe("Base note.");
  });
});
