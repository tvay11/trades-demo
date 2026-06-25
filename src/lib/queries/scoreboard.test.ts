// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildScoreboardRows } from "./scoreboard";

const cand = (ticker: string, stance: "Long" | "Short" | "Neutral", score: number) => ({ ticker, stance, score });
const conv = (score: number, side: "long" | "short") => ({ score, side, breakdown: [] });

describe("buildScoreboardRows", () => {
  it("ranks by conviction desc, nulls last, scanner score tie-break", () => {
    const rows = buildScoreboardRows(
      [cand("A", "Long", 50), cand("B", "Long", 90), cand("C", "Short", 80)],
      new Map([["A", conv(60, "long")], ["B", conv(60, "long")]]), // C has no conviction
      40,
    );
    // A and B both conviction 60 → tie-break scanner (B 90 > A 50); C null → last
    expect(rows.map((r) => r.ticker)).toEqual(["B", "A", "C"]);
    expect(rows[2].conviction).toBeNull();
  });

  it("flags agree when conviction side matches scanner stance", () => {
    const [r] = buildScoreboardRows([cand("A", "Long", 10)], new Map([["A", conv(70, "long")]]));
    expect(r.agreement).toBe("agree");
  });

  it("flags conflict on opposite directions", () => {
    const [r] = buildScoreboardRows([cand("A", "Short", 10)], new Map([["A", conv(70, "long")]]));
    expect(r.agreement).toBe("conflict");
  });

  it("flags mixed when scanner stance is Neutral", () => {
    const [r] = buildScoreboardRows([cand("A", "Neutral", 10)], new Map([["A", conv(70, "long")]]));
    expect(r.agreement).toBe("mixed");
  });

  it("flags mixed and null conviction when the ticker has no conviction", () => {
    const [r] = buildScoreboardRows([cand("A", "Long", 10)], new Map());
    expect(r.agreement).toBe("mixed");
    expect(r.conviction).toBeNull();
    expect(r.convictionSide).toBeNull();
  });

  it("caps at the limit", () => {
    const cands = Array.from({ length: 50 }, (_, i) => cand(`T${i}`, "Long", i));
    expect(buildScoreboardRows(cands, new Map(), 40)).toHaveLength(40);
  });
});
