import { describe, expect, it } from "vitest";

import { getDatasetDefinition } from "./registry";
import { datasetRowsToCsv } from "./csv";

describe("datasetRowsToCsv", () => {
  it("exports dataset columns with analysis-friendly values", () => {
    const definition = getDatasetDefinition("congress-trades");
    if (!definition) throw new Error("missing dataset");

    const csv = datasetRowsToCsv(definition, [
      {
        id: 1,
        representative: "Nancy Pelosi",
        ownerType: "SPOUSE",
        party: "D",
        state: "CA",
        ticker: "nvda",
        transactionType: "Purchase",
        transactionDate: new Date("2026-05-01T00:00:00.000Z"),
        disclosureDate: new Date("2026-05-08T00:00:00.000Z"),
        amountMinCents: 25000000n,
        amountMaxCents: 50000000n,
        ownerName: null,
        documentId: "doc-1",
      },
    ]);

    expect(csv.split("\r\n")[0]).toContain("Ticker");
    expect(csv).toContain("NVDA");
    expect(csv).toContain("2026-05-01");
    expect(csv).toContain("250000");
    expect(csv).not.toContain("$NVDA");
  });
});
