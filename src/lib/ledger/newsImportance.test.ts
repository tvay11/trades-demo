import { describe, expect, it } from "vitest";
import {
  EVENT_BASE, RELEVANCE_MULT, SURPRISE_MULT,
  computeNewsImportance, normRelevance, normEventType, normSurprise,
} from "./newsImportance";

describe("computeNewsImportance", () => {
  it("scores a direct, new, major event near the top", () => {
    expect(computeNewsImportance("direct", "earnings_guidance", "new_material")).toBe(0.95);
  });
  it("scores routine filing about another company near zero", () => {
    // 0.08 * 0.05 * 0.45 = 0.0018 -> rounds to 0
    expect(computeNewsImportance("unrelated", "routine_filing", "recycled_known")).toBe(0);
  });
  it("sector analyst action, incremental: 0.55*0.45*0.75 = 0.1856 -> 0.19", () => {
    expect(computeNewsImportance("sector", "analyst_action", "incremental")).toBe(0.19);
  });
  it("macro regulatory, new: 0.75*0.25*1 = 0.1875 -> 0.19", () => {
    expect(computeNewsImportance("macro", "regulatory_legal", "new_material")).toBe(0.19);
  });
  it("direct M&A recycled: 0.9*1*0.45 = 0.405 -> 0.41", () => {
    expect(computeNewsImportance("direct", "ma_strategic", "recycled_known")).toBe(0.41);
  });
  it("is monotonic in relevance for a fixed event", () => {
    const s = (r: Parameters<typeof computeNewsImportance>[0]) =>
      computeNewsImportance(r, "product_demand", "new_material");
    expect(s("direct")).toBeGreaterThan(s("sector"));
    expect(s("sector")).toBeGreaterThan(s("macro"));
    expect(s("macro")).toBeGreaterThan(s("unrelated"));
  });
  it("every combination stays within [0, 1]", () => {
    for (const e of Object.keys(EVENT_BASE) as (keyof typeof EVENT_BASE)[])
      for (const r of Object.keys(RELEVANCE_MULT) as (keyof typeof RELEVANCE_MULT)[])
        for (const su of Object.keys(SURPRISE_MULT) as (keyof typeof SURPRISE_MULT)[]) {
          const v = computeNewsImportance(r, e, su);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
  });
});

describe("facet normalizers fall back conservatively", () => {
  it("unknown relevance -> unrelated", () => expect(normRelevance("DIRECT!!")).toBe("direct") /* case-insensitive trim */);
  it("garbage relevance -> unrelated", () => expect(normRelevance(42)).toBe("unrelated"));
  it("garbage eventType -> commentary_listicle", () => expect(normEventType(null)).toBe("commentary_listicle"));
  it("garbage surprise -> recycled_known", () => expect(normSurprise("brand new")).toBe("recycled_known"));
  it("valid values pass through", () => {
    expect(normEventType("ma_strategic")).toBe("ma_strategic");
    expect(normSurprise("incremental")).toBe("incremental");
  });
});
