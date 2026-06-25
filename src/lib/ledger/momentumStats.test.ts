import { describe, expect, it } from "vitest";

import { momentumRows } from "./momentumStats";

function mkBars(closes: number[]): { date: string; close: number }[] {
  return closes.map((c, i) => ({ date: `d${i}`, close: c }));
}

describe("momentumRows", () => {
  it("computes 12-1 momentum, 52w-high distance, and RS vs benchmark", () => {
    // 260 bars: flat 100 for 200 bars then ramps to 130 (last close 130).
    const closes = [...Array(200).fill(100), ...Array.from({ length: 60 }, (_, i) => 100 + ((i + 1) * 30) / 60)];
    const bench = mkBars(Array(260).fill(50)); // flat benchmark
    const rows = momentumRows(mkBars(closes), bench);
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("12-1 momentum");
    expect(labels).toContain("52w high distance");
    expect(labels).toContain("RS vs SPY (3m)");
    expect(rows.find((r) => r.label === "12-1 momentum")!.signal).toBe("BULL");   // ~+15% ex-last-month
    expect(rows.find((r) => r.label === "52w high distance")!.signal).toBe("BULL"); // at the high
    expect(rows.find((r) => r.label === "RS vs SPY (3m)")!.signal).toBe("BULL");   // beats flat SPY
  });

  it("flags deep drawdown and negative momentum BEAR", () => {
    const closes = [...Array(60).fill(200), ...Array(200).fill(100)]; // -50% from high long ago
    const rows = momentumRows(mkBars(closes), null);
    expect(rows.find((r) => r.label === "12-1 momentum")!.signal).toBe("BEAR");
    expect(rows.find((r) => r.label === "52w high distance")!.signal).toBe("BEAR");
    expect(rows.find((r) => r.label === "RS vs SPY (3m)")).toBeUndefined(); // no benchmark
  });

  it("omits rows when history is too short", () => {
    expect(momentumRows(mkBars(Array(100).fill(10)), null)).toHaveLength(0);
  });
});
