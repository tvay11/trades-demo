import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/govcontracts.json";
import { GovContractSpec } from "./govcontracts";

describe("GovContractSpec", () => {
  it("parses fixture with cents conversion", () => {
    const rows = GovContractSpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe("LMT");
    expect(rows[0].amountCents).toBe(BigInt(500_000_000));
    expect(rows[1].amountCents).toBe(BigInt(1_250_000_000));
  });
  it("dedup distinct per contract", () => {
    const rows = GovContractSpec.parse(fixture as never);
    expect(GovContractSpec.dedup(rows[0])).not.toBe(GovContractSpec.dedup(rows[1]));
  });

  it("parses current Quiver live rows with Year and Qtr fields", () => {
    const rows = GovContractSpec.parse([
      {
        Ticker: "A",
        Amount: "4028422.99",
        Qtr: 2,
        Year: 2020,
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      ticker: "A",
      amountCents: BigInt(402_842_299),
      agency: null,
      description: "Government contracts Q2 2020",
      contractId: "A-2020-Q2",
    });
    expect(rows[0].awardedAt?.toISOString().slice(0, 10)).toBe("2020-04-01");
  });
});
