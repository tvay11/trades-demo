import { describe, expect, it } from "vitest";

import {
  SMART_MONEY_TOP_FUND_LIMIT,
  SMART_MONEY_FUND_PATTERNS,
  buildTrackedFundSqlFilter,
  isTrackedFundFiler,
  mergeFundPatterns,
  parseThirteenFBackupInsert,
  previousQuarterStartDate,
  rankTopFilerRowsFromBackup,
} from "./smartMoneyFunds";

describe("smart money fund patterns", () => {
  it("keeps tracked fund patterns in a reusable source of truth", () => {
    expect(SMART_MONEY_TOP_FUND_LIMIT).toBe(25);
    expect(SMART_MONEY_FUND_PATTERNS).toContain("Renaissance");
    expect(SMART_MONEY_FUND_PATTERNS).toContain("Two Sigma");
    expect(SMART_MONEY_FUND_PATTERNS).toContain("WorldQuant");
  });

  it("builds a SQL filer filter for the requested holdings alias", () => {
    const filter = buildTrackedFundSqlFilter("holding");

    expect(filter).toContain('holding."filer" LIKE \'%Renaissance%\'');
    expect(filter).toContain(" OR ");
    expect(filter).not.toContain('h."filer"');
  });

  it("matches tracked fund filer names using the same partial matching as SQL", () => {
    expect(isTrackedFundFiler("SHP Wealth Management, LLC", ["SHP Wealth Management"])).toBe(true);
    expect(isTrackedFundFiler("renaissance technologies llc", ["Renaissance"])).toBe(true);
    expect(isTrackedFundFiler("Untracked Advisor", ["Renaissance"])).toBe(false);
  });

  it("computes the previous 13F quarter start date for quarterly refreshes", () => {
    expect(previousQuarterStartDate(new Date("2026-02-16T12:00:00Z"))).toBe("2025-10-01");
    expect(previousQuarterStartDate(new Date("2026-05-16T12:00:00Z"))).toBe("2026-01-01");
    expect(previousQuarterStartDate(new Date("2026-08-16T12:00:00Z"))).toBe("2026-04-01");
    expect(previousQuarterStartDate(new Date("2026-11-16T12:00:00Z"))).toBe("2026-07-01");
  });

  it("merges generated fund patterns without duplicating existing entries", () => {
    const merged = mergeFundPatterns(
      ["Renaissance", "Two Sigma"],
      [" Renaissance ", "SHP Wealth Management", "", "shp wealth management", "Eurizon Capital SGR S.p.A."],
    );

    expect(merged.patterns).toEqual([
      "Renaissance",
      "Two Sigma",
      "SHP Wealth Management",
      "Eurizon Capital SGR S.p.A.",
    ]);
    expect(merged.added).toEqual(["SHP Wealth Management", "Eurizon Capital SGR S.p.A."]);
  });

  it("parses 13F holding inserts from a local Turso backup", () => {
    const parsed = parseThirteenFBackupInsert(
      "INSERT INTO ThirteenFHolding VALUES(1,'O''Brien Asset Management, LLC','AAPL',10,100,'2026-05-08T00:00:00.000+00:00','2026-03-31T00:00:00.000+00:00',NULL,'hash','2026-05-12 04:47:35');",
    );

    expect(parsed).toEqual({
      filer: "O'Brien Asset Management, LLC",
      reportDate: "2026-03-31T00:00:00.000+00:00",
    });
  });

  it("ranks backup filers from the newest report date only", () => {
    const ranked = rankTopFilerRowsFromBackup(
      [
        { filer: "Older Fund", reportDate: "2025-12-31T00:00:00.000+00:00" },
        { filer: "Top Fund", reportDate: "2026-03-31T00:00:00.000+00:00" },
        { filer: "Top Fund", reportDate: "2026-03-31T00:00:00.000+00:00" },
        { filer: "Alpha Fund", reportDate: "2026-03-31T00:00:00.000+00:00" },
        { filer: "Zulu Fund", reportDate: "2026-03-31T00:00:00.000+00:00" },
      ],
      2,
    );

    expect(ranked).toEqual({
      reportDate: "2026-03-31T00:00:00.000+00:00",
      rows: [
        { filer: "Top Fund", rows: 2 },
        { filer: "Alpha Fund", rows: 1 },
      ],
    });
  });
});
