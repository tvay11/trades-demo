import { describe, it, expect } from "vitest";
import { computeOptionsSignals, pickExpirationIndex } from "./optionsSignals";

const spot = 100, expiration = "2026-07-31", daysToExp = 30;
const calls = [
  { strike: 100, impliedVolatility: 0.30, volume: 500, openInterest: 1000 },
  { strike: 110, impliedVolatility: 0.28, volume: 200, openInterest: 800 },
];
const puts = [
  { strike: 100, impliedVolatility: 0.32, volume: 900, openInterest: 1500 },
  { strike: 90, impliedVolatility: 0.40, volume: 400, openInterest: 1200 },
];

describe("pickExpirationIndex", () => {
  it("picks the expiration nearest ~30 days, not the 1-day", () => {
    const now = new Date("2026-06-07");
    const exps = [new Date("2026-06-08"), new Date("2026-06-19"), new Date("2026-07-06"), new Date("2026-09-18")];
    expect(pickExpirationIndex(exps, now, 30)).toBe(2); // 2026-07-06 (~29d) closest to 30
  });
  it("falls back to 0 on empty array", () => {
    expect(pickExpirationIndex([], new Date(), 30)).toBe(0);
  });
});

describe("computeOptionsSignals", () => {
  it("computes PCR, ATM IV, downside skew, expected move, bearish lean", () => {
    const r = computeOptionsSignals({ spot, expiration, daysToExp, calls, puts });
    expect(r.putCallVolume).toBeCloseTo(1300 / 700, 2);
    expect(r.atmIvPct).toBeCloseTo(31, 0);              // avg of 30/32 at strike 100
    expect(r.ivSkewPct).toBeGreaterThan(0);             // OTM put IV(40) > OTM call IV(28)
    expect(r.expectedMovePct).toBeGreaterThan(0);
    expect(r.lean).toBe("bearish");                     // PCR>1 + positive (fearful) skew
  });
  it("returns neutral/nulls on empty chain", () => {
    const r = computeOptionsSignals({ spot, expiration, daysToExp, calls: [], puts: [] });
    expect(r.lean).toBe("neutral");
    expect(r.putCallVolume).toBeNull();
  });
});
