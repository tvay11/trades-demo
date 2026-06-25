import { describe, expect, it } from "vitest";

import { settleDataHealthSources, shapeDataHealth } from "./dataHealth";

const now = new Date("2026-05-10T12:00:00Z");

describe("data health shaping", () => {
  it("settles failed source reads into warnings and safe defaults", async () => {
    const settled = await settleDataHealthSources({
      summaries: Promise.reject(new Error("fetch failed")),
      jobs: Promise.resolve([]),
      congressTickers: Promise.reject(new Error("ticker fetch failed")),
      priceTickers: Promise.resolve(["NVDA"]),
      unmatchedPoliticians: Promise.resolve([]),
      latestIngestRun: Promise.resolve(null),
      committeeRows: Promise.resolve(2),
      assignmentRows: Promise.resolve(4),
      politiciansWithCommittees: Promise.resolve(1),
      politiciansWithBioguide: Promise.resolve(1),
      latestAssignmentSync: Promise.resolve(null),
    });

    expect(settled.summaries).toEqual([]);
    expect(settled.congressTickers).toEqual([]);
    expect(settled.priceTickers).toEqual(["NVDA"]);
    expect(settled.readWarnings).toEqual([
      "Dataset summaries: fetch failed",
      "Congress ticker coverage: ticker fetch failed",
    ]);
  });

  it("reports core table counts, price coverage, committee sync, ingest state, and fallback warnings", () => {
    const health = shapeDataHealth({
      now,
      summaries: [
        summary("congress-trades", "CongressTrade", "Congress trades", 3),
        summary("politicians", "Politician", "Politicians", 2),
        summary("stocks", "Stock", "Stocks", 1),
        summary("ticker-prices", "TickerPriceCache", "Ticker prices", 8),
      ],
      jobs: [
        {
          dataset: "congress-trades",
          mode: "bulk",
          status: "complete",
          cursor: null,
          totalIngested: 3,
          lastRunAt: new Date("2026-05-10T10:00:00Z"),
          lastError: null,
        },
      ],
      congressTickers: ["NVDA", "MSFT"],
      priceTickers: ["NVDA"],
      unmatchedPoliticians: [
        { name: "Unmatched Member", party: "D", state: "CA", chamber: "House", tradeCount: 2 },
      ],
      latestIngestRun: {
        dataset: "congress-trades",
        mode: "bulk",
        startedAt: new Date("2026-05-10T10:00:00Z"),
        finishedAt: new Date("2026-05-10T10:01:00Z"),
        rowsFetched: 3,
        rowsInserted: 3,
        error: null,
      },
      committeeCounts: {
        committees: 4,
        assignments: 6,
        politiciansWithCommittees: 1,
        politiciansWithBioguide: 1,
        latestAssignmentSync: new Date("2026-05-10T09:00:00Z"),
      },
    });

    expect(health.coreChecks.map((check) => [check.label, check.value, check.tone])).toEqual([
      ["CongressTrade rows", "3", "good"],
      ["Politician rows", "2", "good"],
      ["Stock rows", "1", "good"],
      ["TickerPriceCache rows", "8", "good"],
    ]);
    expect(health.priceCoverage).toMatchObject({
      congressTickerCount: 2,
      priceTickerCount: 1,
      coveredTickerCount: 1,
      missingTickerCount: 1,
      coveragePercent: 50,
      missingTickers: ["MSFT"],
    });
    expect(health.committeeSync).toMatchObject({
      committeeRows: 4,
      assignmentRows: 6,
      politiciansWithCommittees: 1,
      politiciansWithBioguide: 1,
      assignmentCoveragePercent: 50,
      bioguideCoveragePercent: 50,
    });
    expect(health.latestMarketDataIngest).toMatchObject({
      dataset: "congress-trades",
      rowsInserted: 3,
      tone: "good",
    });
    expect(health.unmatchedPoliticians[0].name).toBe("Unmatched Member");
    expect(health.fallbackWarnings).toContain(
      "1 congressional ticker is missing price-cache coverage for disclosure return windows.",
    );
  });

  it("classifies ingest job rows by error before freshness", () => {
    const health = shapeDataHealth({
      now,
      summaries: [
        summary("congress-trades", "CongressTrade", "Congress trades", 3),
        summary("politicians", "Politician", "Politicians", 2),
        summary("stocks", "Stock", "Stocks", 1),
        summary("ticker-prices", "TickerPriceCache", "Ticker prices", 8),
      ],
      jobs: [
        {
          dataset: "GovContract",
          mode: "live",
          status: "active",
          cursor: null,
          totalIngested: 2208,
          lastRunAt: new Date("2026-05-10T11:55:00Z"),
          lastError: "TypeError: fetch failed",
        },
        {
          dataset: "CongressTrade",
          mode: "live",
          status: "active",
          cursor: null,
          totalIngested: 190,
          lastRunAt: new Date("2026-05-10T11:55:00Z"),
          lastError: null,
        },
      ],
      congressTickers: ["NVDA"],
      priceTickers: ["NVDA"],
      unmatchedPoliticians: [],
      latestIngestRun: null,
      committeeCounts: {
        committees: 1,
        assignments: 1,
        politiciansWithCommittees: 1,
        politiciansWithBioguide: 1,
        latestAssignmentSync: new Date("2026-05-10T09:00:00Z"),
      },
    });

    expect(health.ingestJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dataset: "GovContract",
          lastError: "TypeError: fetch failed",
          health: "error",
          healthLabel: "ERROR",
          healthTone: "bad",
        }),
        expect.objectContaining({
          dataset: "CongressTrade",
          lastError: null,
          health: "ok",
          healthLabel: "OK",
          healthTone: "good",
        }),
      ]),
    );
  });

  it("warns clearly when SQL data required by the main app is empty", () => {
    const health = shapeDataHealth({
      now,
      summaries: [
        summary("congress-trades", "CongressTrade", "Congress trades", 0),
        summary("politicians", "Politician", "Politicians", 0),
        summary("stocks", "Stock", "Stocks", 0),
        summary("ticker-prices", "TickerPriceCache", "Ticker prices", 0),
      ],
      jobs: [],
      congressTickers: [],
      priceTickers: [],
      unmatchedPoliticians: [],
      latestIngestRun: null,
      committeeCounts: {
        committees: 0,
        assignments: 0,
        politiciansWithCommittees: 0,
        politiciansWithBioguide: 0,
        latestAssignmentSync: null,
      },
    });

    expect(health.coreChecks.every((check) => check.tone !== "good")).toBe(true);
    expect(health.latestMarketDataIngest).toMatchObject({ label: "Latest external ingest", value: "Never", tone: "warn" });
    expect(health.fallbackWarnings).toEqual([
      "Dashboard, trades, politicians, analysis, and command search will show empty SQL states because CongressTrade is empty.",
      "Politician pages and committee sync cannot be trusted until Politician rows exist.",
      "Ticker pages will infer company names from disclosures because Stock is empty.",
      "Disclosure-date return windows are unavailable because TickerPriceCache is empty.",
      "Committee context is unavailable until committee assignments are synced.",
    ]);
  });
});

function summary(slug: string, tableName: string, label: string, rowCount: number) {
  return {
    slug,
    tableName,
    label,
    rowCount,
    description: "",
    modelName: tableName,
    columns: [],
  };
}
