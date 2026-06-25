import { describe, it, expect } from "vitest";
import { scoreMacroRegime } from "./macroRegime";

describe("scoreMacroRegime", () => {
  it("flags risk-off on inverted curve + wide spreads + high VIX", () => {
    const r = scoreMacroRegime({ curveBp: -40, hySpreadPct: 6.5, vix: 32, dollarChgPct: 3 });
    expect(r.label).toBe("risk-off");
    expect(r.score).toBeLessThan(0);
    expect(r.factors).toHaveLength(4);
  });
  it("flags risk-on on steep curve + tight spreads + low VIX", () => {
    const r = scoreMacroRegime({ curveBp: 120, hySpreadPct: 2.8, vix: 13, dollarChgPct: -0.5 });
    expect(r.label).toBe("risk-on");
    expect(r.score).toBeGreaterThan(0);
  });
  it("handles missing inputs as neutral", () => {
    const r = scoreMacroRegime({ curveBp: null, hySpreadPct: null, vix: null, dollarChgPct: null });
    expect(r.label).toBe("neutral");
    expect(r.score).toBe(0);
  });
  it("marks regime low-confidence when fewer than 2 factors load", () => {
    const r = scoreMacroRegime({ curveBp: null, hySpreadPct: 2.74, vix: null, dollarChgPct: null });
    expect(r.factors).toHaveLength(1);
    expect(r.confidence).toBe("low");          // new field
  });
});
