// @vitest-environment node
import { describe, expect, it } from "vitest";
import { shapeExcessWindows } from "@/lib/queries/excessWindows";

const rows = (pairs: [string, number][]) => pairs.map(([d, c]) => ({ date: new Date(d), close: c }));
const ticker = rows([["2026-01-02", 100], ["2026-01-09", 105], ["2026-02-02", 120], ["2026-04-03", 130]]);
const spy = rows([["2026-01-02", 200], ["2026-01-09", 201], ["2026-02-02", 204], ["2026-04-03", 206]]);
const trade = { transactionType: "purchase", disclosureDate: new Date("2026-01-02") };

describe("shapeExcessWindows", () => {
  it("averages excess returns across windows", () => {
    const w = shapeExcessWindows([trade], ticker, spy);
    expect(w.avgExcess30).toBeCloseTo(20 - 2, 1); // ticker +20% vs spy +2%
    expect(w.samples30).toBe(1);
    expect(w.positive30Pct).toBe(100);
  });
  it("returns nulls with no usable samples", () => {
    const w = shapeExcessWindows([], ticker, spy);
    expect(w.avgExcess30).toBeNull();
  });
});
