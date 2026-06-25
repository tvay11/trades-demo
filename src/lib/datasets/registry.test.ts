import { describe, expect, it } from "vitest";

import {
  DATASET_DEFINITIONS,
  formatDatasetValue,
  getDatasetDefinition,
  normalizeDatasetPage,
} from "./registry";

describe("dataset registry", () => {
  it("exposes the core SQL tables as route-safe dataset slugs", () => {
    const slugs = DATASET_DEFINITIONS.map((dataset) => dataset.slug);

    expect(slugs).toContain("stocks");
    expect(slugs).toContain("ticker-prices");
    expect(slugs).toContain("congress-trades");
    expect(slugs).toContain("politicians");
    expect(slugs).toContain("ingest-runs");
  });

  it("looks up dataset definitions by slug", () => {
    expect(getDatasetDefinition("stocks")?.tableName).toBe("Stock");
    expect(getDatasetDefinition("not-real")).toBeUndefined();
  });

  it("formats table values for dense financial views", () => {
    expect(
      formatDatasetValue("NVDA", { key: "ticker", label: "Ticker", kind: "ticker" }),
    ).toBe("$NVDA");
    expect(
      formatDatasetValue(123_456_789, {
        key: "price",
        label: "Price",
        kind: "cents",
      }),
    ).toBe("$1,234,567.89");
    expect(
      formatDatasetValue(new Date("2026-05-09T18:30:00.000Z"), {
        key: "filedAt",
        label: "Filed",
        kind: "date",
      }),
    ).toMatch(/May 9, 2026/);
    expect(formatDatasetValue(null, { key: "sector", label: "Sector" })).toBe("-");
  });

  it("normalizes invalid page params", () => {
    expect(normalizeDatasetPage("3")).toBe(3);
    expect(normalizeDatasetPage("-1")).toBe(1);
    expect(normalizeDatasetPage("abc")).toBe(1);
    expect(normalizeDatasetPage(undefined)).toBe(1);
  });

  it("defines trader-first filter metadata for dataset explorer pages", () => {
    const congress = getDatasetDefinition("congress-trades");
    const lobbying = getDatasetDefinition("lobbying-disclosures");

    expect(congress?.searchableColumns).toEqual(
      expect.arrayContaining(["representative", "ticker", "transactionType"]),
    );
    expect(congress?.defaultSort).toEqual({ key: "disclosureDate", dir: "desc" });
    expect(congress?.filterGroups.map((group) => group.label)).toEqual(
      expect.arrayContaining(["Entity", "Time", "Magnitude", "Direction"]),
    );
    expect(congress?.filters.map((filter) => filter.key)).toEqual(
      expect.arrayContaining([
        "party",
        "ticker",
        "assetDescription",
        "house",
        "reportDate",
        "transactionDate",
        "amountMinCents",
        "ownerType",
      ]),
    );

    const politicians = getDatasetDefinition("politicians");
    expect(politicians?.filters.map((filter) => filter.key)).toEqual(
      expect.arrayContaining(["committee", "ranking", "trades30d", "trades90d"]),
    );

    expect(lobbying?.filters.map((filter) => filter.key)).toEqual(
      expect.arrayContaining(["client", "ticker", "filingYear", "filedAt"]),
    );
  });
});
