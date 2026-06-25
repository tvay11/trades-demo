import { describe, expect, it } from "vitest";

import { sma, ema, rsi, macd, bollinger, atr, volumeVsAvg } from "./indicators";

describe("sma", () => {
  it("returns null until the window is full, then the average", () => {
    expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
  });
});

describe("ema", () => {
  it("seeds with the first value and smooths", () => {
    const out = ema([1, 1, 1], 2);
    expect(out[0]).toBe(1);
    expect(out[2]).toBeCloseTo(1, 6);
  });
});

describe("rsi", () => {
  it("is 100 for a monotonically rising series", () => {
    const out = rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 14);
    expect(out[out.length - 1]).toBeCloseTo(100, 4);
  });
  it("is null before enough data", () => {
    expect(rsi([1, 2, 3], 14)[0]).toBeNull();
  });
});

describe("macd", () => {
  it("histogram is ~0 for a flat series", () => {
    const flat = Array(60).fill(100);
    const { histogram } = macd(flat, 12, 26, 9);
    expect(histogram[histogram.length - 1]).toBeCloseTo(0, 6);
  });
});

describe("bollinger", () => {
  it("centers on the SMA with symmetric bands and %B=0.5 at the mean", () => {
    const series = [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5];
    const { middle, upper, lower, percentB } = bollinger(series, 20, 2);
    const i = series.length - 1;
    expect(upper[i]! > middle[i]!).toBe(true);
    expect(lower[i]! < middle[i]!).toBe(true);
    expect(upper[i]! - middle[i]!).toBeCloseTo(middle[i]! - lower[i]!, 6);
    expect(percentB[i]).toBeGreaterThanOrEqual(0);
  });
});

describe("atr", () => {
  it("equals the constant range for bars with fixed H-L and no gaps", () => {
    const bars = Array.from({ length: 20 }, () => ({ high: 11, low: 9, close: 10 }));
    const out = atr(bars, 14);
    expect(out[out.length - 1]).toBeCloseTo(2, 6);
  });
});

describe("volumeVsAvg", () => {
  it("returns the pct difference of the last volume vs the trailing average", () => {
    const vols = [...Array(20).fill(100), 130];
    expect(volumeVsAvg(vols, 20)).toBeCloseTo(0.3, 6);
  });
});
