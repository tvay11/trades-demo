import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

describe("Quiver factual expansion schema", () => {
  const expectedModels = [
    "BillSummary",
    "BillTheme",
    "BillTickerLink",
    "CommitteeJurisdiction",
    "LobbyingIssue",
    "CompanyAlias",
    "ApiEndpointCatalog",
    "ApiProbeResult",
  ];

  it("defines the factual context and API observability tables", () => {
    for (const model of expectedModels) {
      expect(schema).toContain(`model ${model} {`);
    }
  });

  it("defines a unique ticker watchlist table", () => {
    expect(schema).toContain("model WatchlistItem {");
    expect(schema).toMatch(/\bticker\s+String\s+@unique/);
  });

  it("defines a one-row-per-ticker earnings cache table", () => {
    expect(schema).toContain("model EarningsEvent {");
    expect(schema).toMatch(/\bticker\s+String\s+@id/);
    expect(schema).toMatch(/\bearningsDate\s+DateTime\?/);
  });

  it("keeps bill, committee, lobbying, and probe tables joinable", () => {
    expect(schema).toMatch(/\bthemes\s+BillTheme\[\]/);
    expect(schema).toMatch(/\btickerLinks\s+BillTickerLink\[\]/);
    expect(schema).toMatch(/\bjurisdictions\s+CommitteeJurisdiction\[\]/);
    expect(schema).toMatch(/\bnormalizedIssues\s+LobbyingIssue\[\]/);
    expect(schema).toMatch(/\bprobeResults\s+ApiProbeResult\[\]/);
  });

  it("stores large money values as 64-bit integers", () => {
    for (const column of [
      "amountMinCents",
      "amountMaxCents",
      "amountCents",
      "totalValueCents",
      "valueCents",
      "trustValueCents",
      // Added 2026-05-17 (Phase 4.2): the Backtest cents columns were Int
      // (32-bit, overflows at \$21M). Test guards against regression.
      "totalEstimatedCapitalCents",
      "entryPriceCents",
      "exitPriceCents",
      "estimatedCapitalCents",
    ]) {
      expect(schema).not.toMatch(new RegExp(`\\b${column}\\s+Int\\??`));
    }

    expect(schema).toMatch(/\bamountMaxCents\s+BigInt\?/);
    expect(schema).toMatch(/\bvalueCents\s+BigInt\?/);
    expect(schema).toMatch(/\btrustValueCents\s+BigInt\?/);
    expect(schema).toMatch(/\btotalEstimatedCapitalCents\s+BigInt/);
    expect(schema).toMatch(/\bentryPriceCents\s+BigInt/);
    expect(schema).toMatch(/\bexitPriceCents\s+BigInt/);
    expect(schema).toMatch(/\bestimatedCapitalCents\s+BigInt/);
  });
});
