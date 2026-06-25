import { describe, expect, it } from "vitest";

import { getDatasetDefinition } from "./registry";
import {
  buildDatasetHref,
  buildDatasetOrderBy,
  buildDatasetWhere,
  parseDatasetQuery,
  summarizeActiveFilters,
} from "./filters";

describe("dataset filters", () => {
  it("parses dataset query params into normalized state", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      q: "NVDA",
      page: "3",
      sort: "transactionDate",
      dir: "asc",
      f_party: "D",
      f_amountMinCents_min: "100000",
      f_transactionDate_from: "2026-01-01",
    });

    expect(query.page).toBe(3);
    expect(query.search).toBe("NVDA");
    expect(query.sort).toEqual({ key: "transactionDate", dir: "asc" });
    expect(query.filters.party).toEqual({ kind: "enum", value: "D" });
    expect(query.filters.amountMinCents).toEqual({
      kind: "number-range",
      min: 100000,
    });
    expect(query.filters.transactionDate).toEqual({
      kind: "date-range",
      from: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

  it("drops invalid params and falls back to default sort", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      page: "-10",
      sort: "nope",
      dir: "sideways",
      f_party: "X",
      f_transactionDate_from: "not-a-date",
    });

    expect(query.page).toBe(1);
    expect(query.sort).toEqual(definition.defaultSort);
    expect(query.filters).toEqual({});
  });

  it("builds Prisma where clauses for search, enum, numeric, and date filters", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      q: "NVDA",
      f_party: "D",
      f_amountMinCents_min: "100000",
      f_transactionDate_from: "2026-01-01",
    });

    expect(buildDatasetWhere(definition, query)).toEqual({
      AND: expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            { representative: { contains: "NVDA" } },
            { ticker: { contains: "NVDA" } },
            { assetDescription: { contains: "NVDA" } },
            { transactionType: { contains: "NVDA" } },
            { state: { contains: "NVDA" } },
            { ownerType: { contains: "NVDA" } },
            { ownerName: { contains: "NVDA" } },
            { ownerRaw: { contains: "NVDA" } },
            { documentId: { contains: "NVDA" } },
            { amountRangeRaw: { contains: "NVDA" } },
          ]),
        }),
        { party: "D" },
        { amountMinCents: { gte: 100000 } },
        { transactionDate: { gte: new Date("2026-01-01T00:00:00.000Z") } },
      ]),
    });
  });

  it("builds sort state and filter-preserving page links", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      q: "NVDA",
      sort: "transactionDate",
      dir: "desc",
      f_party: "D",
    });

    expect(buildDatasetOrderBy(definition, query)).toEqual({
      transactionDate: "desc",
    });
    expect(buildDatasetHref("/datasets/congress-trades", query, { page: 2 })).toBe(
      "/datasets/congress-trades?q=NVDA&sort=transactionDate&dir=desc&f_party=D&page=2",
    );
  });

  it("summarizes active filters into removable trader-facing chips", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      q: "NVDA",
      page: "4",
      sort: "transactionDate",
      dir: "desc",
      f_party: "D",
      f_amountMinCents_min: "100000",
      f_transactionDate_from: "2026-01-01",
      f_transactionDate_to: "2026-01-31",
    });

    const chips = summarizeActiveFilters("/datasets/congress-trades", definition, query);

    expect(chips.map(({ key, label, value }) => ({ key, label, value }))).toEqual([
      { key: "search", label: "Search", value: "NVDA" },
      { key: "party", label: "Party", value: "Democrat" },
      { key: "transactionDate", label: "Trade Date", value: "2026-01-01 to 2026-01-31" },
      { key: "amountMinCents", label: "Minimum Amount", value: ">= 100,000" },
    ]);

    const hrefByKey = Object.fromEntries(
      chips.map((chip) => [chip.key, new URL(chip.href, "https://example.test").searchParams]),
    );

    expect(hrefByKey.search.get("q")).toBeNull();
    expect(hrefByKey.search.get("f_party")).toBe("D");
    expect(hrefByKey.party.get("f_party")).toBeNull();
    expect(hrefByKey.party.get("q")).toBe("NVDA");
    expect(hrefByKey.amountMinCents.get("f_amountMinCents_min")).toBeNull();
    expect(hrefByKey.transactionDate.get("f_transactionDate_from")).toBeNull();
    expect(hrefByKey.transactionDate.get("f_transactionDate_to")).toBeNull();
  });

  it("keeps disclosure-band amount selections as numeric range filters", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      f_amountMinCents_min: "1500000",
      f_amountMaxCents_max: "50000000",
    });

    expect(query.filters.amountMinCents).toEqual({
      kind: "number-range",
      min: 1500000,
    });
    expect(query.filters.amountMaxCents).toEqual({
      kind: "number-range",
      max: 50000000,
    });

    expect(buildDatasetWhere(definition, query)).toEqual({
      AND: expect.arrayContaining([
        { amountMinCents: { gte: 1500000 } },
        { amountMaxCents: { lte: 50000000 } },
      ]),
    });
  });

  it("parses transaction type as an enum filter", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      f_transactionType: "Purchase",
    });

    expect(query.filters.transactionType).toEqual({
      kind: "enum",
      value: "Purchase",
    });
    expect(buildDatasetWhere(definition, query)).toEqual({
      AND: [{ transactionType: "Purchase" }],
    });
  });

  it("treats Sale as both Sale and Sale (Full) stored transaction labels", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      f_transactionType: "Sale",
    });

    expect(buildDatasetWhere(definition, query)).toEqual({
      AND: [
        {
          OR: [
            { transactionType: "Sale" },
            { transactionType: "Sale (Full)" },
          ],
        },
      ],
    });
  });

  it("parses politician virtual filters without sending them to Prisma where clauses", () => {
    const definition = getDatasetDefinition("politicians");
    if (!definition) throw new Error("missing dataset");

    const query = parseDatasetQuery(definition, {
      f_committee: "Finance",
      f_trades90d_min: "3",
      f_ranking_max: "5",
    });

    expect(query.filters.committee).toEqual({ kind: "text", value: "Finance" });
    expect(query.filters.trades90d).toEqual({ kind: "number-range", min: 3 });
    expect(query.filters.ranking).toEqual({ kind: "number-range", max: 5 });
    expect(buildDatasetWhere(definition, query)).toEqual({});
  });
});
