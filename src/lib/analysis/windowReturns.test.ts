// @vitest-environment node
import { describe, expect, it } from "vitest";
import { closeOnOrAfter, excessReturnPct, windowReturnPct } from "./windowReturns";

const rows = (pairs: [string, number][]) =>
  pairs.map(([d, c]) => ({ date: new Date(d), close: c }));

const ticker = rows([["2026-01-02", 100], ["2026-01-05", 110], ["2026-02-02", 120]]);
const bench = rows([["2026-01-02", 200], ["2026-01-05", 202], ["2026-02-02", 210]]);

describe("closeOnOrAfter", () => {
  it("returns the first row on/after the date", () => {
    expect(closeOnOrAfter(new Date("2026-01-03"), ticker)?.close).toBe(110);
  });
  it("returns null past the last row", () => {
    expect(closeOnOrAfter(new Date("2026-03-01"), ticker)).toBeNull();
  });
});

describe("windowReturnPct", () => {
  it("computes entry→exit percent over the horizon", () => {
    const r = windowReturnPct(new Date("2026-01-02"), 30, ticker);
    expect(r?.pct).toBeCloseTo(20, 5); // 100 → 120
  });
  it("returns null when the exit is missing", () => {
    expect(windowReturnPct(new Date("2026-02-01"), 30, ticker)).toBeNull();
  });
});

describe("excessReturnPct", () => {
  it("long: ticker minus bench", () => {
    const r = excessReturnPct("long", new Date("2026-01-02"), 30, ticker, bench);
    expect(r?.tickerPct).toBeCloseTo(20, 5);
    expect(r?.benchPct).toBeCloseTo(5, 5); // 200 → 210
    expect(r?.excessPct).toBeCloseTo(15, 5);
    expect(r?.win).toBe(true);
  });
  it("short: bench minus ticker", () => {
    const r = excessReturnPct("short", new Date("2026-01-02"), 30, ticker, bench);
    expect(r?.excessPct).toBeCloseTo(-15, 5);
    expect(r?.win).toBe(false);
  });
  it("null when either series lacks the window", () => {
    expect(excessReturnPct("long", new Date("2026-01-02"), 30, ticker, [])).toBeNull();
  });
});
