// @vitest-environment node
import { describe, expect, it } from "vitest";
import { topWsbSurges } from "./altFlowMovers";

describe("topWsbSurges", () => {
  it("computes surge ratio and sorts descending", () => {
    const rows = [
      { ticker: "GME", mentions7d: 300, mentionsPrior7d: 100 }, // ratio 3.0
      { ticker: "AMC", mentions7d: 500, mentionsPrior7d: 100 }, // ratio 5.0
      { ticker: "BB",  mentions7d: 220, mentionsPrior7d: 100 }, // ratio 2.2
    ];
    const result = topWsbSurges(rows, 3);
    expect(result).toHaveLength(3);
    expect(result[0].ticker).toBe("AMC");
    expect(result[0].surgeRatio).toBe(5.0);
    expect(result[1].ticker).toBe("GME");
    expect(result[1].surgeRatio).toBe(3.0);
    expect(result[2].ticker).toBe("BB");
    expect(result[2].surgeRatio).toBe(2.2);
  });

  it("filters out rows with mentionsPrior7d < 10", () => {
    const rows = [
      { ticker: "HUGE", mentions7d: 999, mentionsPrior7d: 5 }, // base too low — filtered
      { ticker: "GME",  mentions7d: 200, mentionsPrior7d: 50 }, // ratio 4.0 — kept
      { ticker: "TINY", mentions7d: 100, mentionsPrior7d: 9 }, // base too low — filtered
    ];
    const result = topWsbSurges(rows, 10);
    expect(result).toHaveLength(1);
    expect(result[0].ticker).toBe("GME");
    expect(result[0].surgeRatio).toBe(4.0);
  });

  it("limits output to N rows", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      ticker: `T${i}`,
      mentions7d: (10 - i) * 20,
      mentionsPrior7d: 10,
    }));
    const result = topWsbSurges(rows, 4);
    expect(result).toHaveLength(4);
    // top ratio should be first
    expect(result[0].surgeRatio).toBeGreaterThanOrEqual(result[1].surgeRatio);
  });
});
