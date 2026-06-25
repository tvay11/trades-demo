import { describe, expect, it } from "vitest";

import { computeIvRank } from "./ivRank";

describe("computeIvRank", () => {
  it("needs >= 5 historical samples", () => {
    expect(computeIvRank(40, [30, 35, 50, 45])).toBeNull();
  });
  it("percentile of history strictly below current", () => {
    expect(computeIvRank(40, [30, 35, 50, 45, 60])).toBe(40); // 2 of 5 below
    expect(computeIvRank(70, [30, 35, 50, 45, 60])).toBe(100);
    expect(computeIvRank(10, [30, 35, 50, 45, 60])).toBe(0);
  });
});
