import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}));

import { db } from "@/lib/db";
import { getSmartMoneyAnalysis } from "./smartMoney";

describe("getSmartMoneyAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fall back to unrelated top 13F filers when tracked fund patterns do not match", async () => {
    const reportDate = new Date("2026-03-31T00:00:00Z");
    const queryRaw = vi.mocked(db.$queryRaw);
    queryRaw.mockResolvedValueOnce([{ reportDate }]);
    queryRaw.mockResolvedValueOnce([]);

    const analysis = await getSmartMoneyAnalysis();

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(analysis.reportDate).toEqual(reportDate);
    expect(analysis.signals).toHaveLength(0);
    expect(analysis.summary.fundCount).toBe(0);
  });
});
