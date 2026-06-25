import { describe, expect, it } from "vitest";

import { buildInsiderFlowRowsSql, buildRecentOffExchangeRowsSql } from "./marketSignalData";

describe("market signal data queries", () => {
  it("aggregates insider flow by ticker without row-limiting the source window", () => {
    const sql = buildInsiderFlowRowsSql();

    expect(sql).toContain('FROM "InsiderTrade"');
    expect(sql).toContain('GROUP BY "ticker"');
    expect(sql).not.toContain("LIMIT");
  });

  it("loads off-exchange rows by recent snapshot dates instead of an arbitrary row cap", () => {
    const sql = buildRecentOffExchangeRowsSql();

    expect(sql).toContain('FROM "OffExchangeActivity"');
    expect(sql).toContain('GROUP BY DATE("date")');
    expect(sql).toContain("LIMIT 20");
    expect(sql).not.toContain("LIMIT 4000");
  });

  it("aggregates off-exchange tape to one row per ticker", () => {
    const sql = buildRecentOffExchangeRowsSql();

    expect(sql).toContain("WITH recent_dates AS");
    expect(sql).toContain("per_day AS");
    expect(sql).toContain('AS "latestDarkPoolPercent"');
    expect(sql).toContain('AS "averageDarkPoolPercent"');
    expect(sql).toContain('AS "offExchangeSampleSize"');
    expect(sql).toContain('GROUP BY p."ticker"');
  });
});
