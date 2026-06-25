import { describe, expect, it } from "vitest";

import { DEFAULT_DAILY_DATASETS, dailyCutoffIso, resolveDailyDatasetNames } from "@/lib/ingest/dailyConfig";

describe("daily ingest dataset selection", () => {
  it("defaults normal daily ingest to core congressional trade datasets", () => {
    expect(resolveDailyDatasetNames([], undefined)).toEqual(DEFAULT_DAILY_DATASETS);
  });

  it("allows an env allowlist for scheduled broader daily runs", () => {
    expect(resolveDailyDatasetNames([], "CongressTrade,InsiderTrade GovContract")).toEqual([
      "CongressTrade",
      "InsiderTrade",
      "GovContract",
    ]);
  });

  it("lets a manual command request every dataset", () => {
    expect(resolveDailyDatasetNames(["all"], "CongressTrade")).toBeNull();
  });

  it("lets explicit command arguments override the env allowlist", () => {
    expect(resolveDailyDatasetNames(["HouseTrade"], "CongressTrade,SenateTrade")).toEqual([
      "HouseTrade",
    ]);
  });

  it("computes a rolling UTC cutoff for daily live ingest", () => {
    expect(dailyCutoffIso(new Date("2026-05-16T05:41:04.887Z"), 3)).toBe("2026-05-13");
  });
});
