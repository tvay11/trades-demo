import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/offexchange.json";
import { buildOffExchangeUpsertSql, OffExchangeActivitySpec } from "./offexchange";

describe("OffExchangeActivitySpec", () => {
  it("parses fixture", () => {
    const rows = OffExchangeActivitySpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe("AAPL");
    expect(rows[0].shortVolumePercent).toBeCloseTo(2.4);
    expect(rows[1].darkPoolPercent).toBeCloseTo(42.1);
  });
  it("dedup distinct per (ticker, date)", () => {
    const rows = OffExchangeActivitySpec.parse(fixture as never);
    expect(OffExchangeActivitySpec.dedup(rows[0])).not.toBe(OffExchangeActivitySpec.dedup(rows[1]));
  });

  it("parses current Quiver live rows with OTC and DPI fields", () => {
    const rows = OffExchangeActivitySpec.parse([
      {
        Ticker: "INTC",
        Date: "2026-05-08",
        OTC_Short: 65504365,
        OTC_Total: 116313845,
        DPI: 0.563169119046704,
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      ticker: "INTC",
      shortVolume: 65504365,
      totalVolume: 116313845,
      shortVolumePercent: 56.3169119046704,
      darkPoolPercent: 56.3169119046704,
    });
  });

  it("coerces numeric strings from live Quiver rows", () => {
    const rows = OffExchangeActivitySpec.parse([
      {
        Ticker: "NVDA",
        Date: "2026-05-10",
        OTC_Short: "1200",
        OTC_Total: "4000",
        DPI: "0.42",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      shortVolume: 1200,
      totalVolume: 4000,
      shortVolumePercent: 42,
      darkPoolPercent: 42,
    });
  });

  it("uses one sourceHash conflict target for correction-safe batch upserts", () => {
    const sql = buildOffExchangeUpsertSql(2);

    expect(sql).toContain('INSERT INTO "OffExchangeActivity"');
    expect(sql).toContain("VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)");
    expect(sql).toContain('ON CONFLICT("sourceHash") DO UPDATE');
    expect(sql).toContain('"shortVolume" = excluded."shortVolume"');
    expect(sql).toContain('"darkPoolPercent" = excluded."darkPoolPercent"');
  });
});
