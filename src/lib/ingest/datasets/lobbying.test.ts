import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/lobbying.json";
import { LobbyingDisclosureSpec } from "./lobbying";

describe("LobbyingDisclosureSpec", () => {
  it("parses the fixture, converts amount to cents", () => {
    const rows = LobbyingDisclosureSpec.parse(fixture as never);
    expect(rows).toHaveLength(1);
    expect(rows[0].client).toBe("Acme Corp");
    expect(rows[0].registrant).toBe("Big Lobby LLC");
    expect(rows[0].amountCents).toBe(BigInt(25_000_000));
    expect(rows[0].filingYear).toBe(2025);
    expect(rows[0].filingQuarter).toBe(3);
  });
  it("dedup hash is stable", () => {
    const rows = LobbyingDisclosureSpec.parse(fixture as never);
    expect(LobbyingDisclosureSpec.dedup(rows[0])).toBe(LobbyingDisclosureSpec.dedup(rows[0]));
  });

  it("parses current Quiver live rows with Date and Issue fields", () => {
    const rows = LobbyingDisclosureSpec.parse([
      {
        Date: "2026-05-08",
        Amount: "80000.0",
        Client: "SOLENO THERAPEUTICS INC.",
        Issue: "Health Issues",
        Specific_Issue: "Most Favored Nation, orphan drug exemption",
        Registrant: "Example Lobby LLC",
        Ticker: "SLNO",
      },
    ] as never);

    expect(rows[0]).toMatchObject({
      client: "SOLENO THERAPEUTICS INC.",
      registrant: "Example Lobby LLC",
      ticker: "SLNO",
      amountCents: BigInt(8_000_000),
      filingYear: 2026,
      filingQuarter: 2,
      issues: "Health Issues\nMost Favored Nation, orphan drug exemption",
    });
    expect(rows[0].filedAt?.toISOString().slice(0, 10)).toBe("2026-05-08");
  });
});
