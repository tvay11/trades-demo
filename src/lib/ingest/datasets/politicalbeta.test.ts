import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/politicalbeta.json";
import { PoliticalBetaSpec } from "./politicalbeta";

describe("PoliticalBetaSpec", () => {
  it("parses fixture", () => {
    const rows = PoliticalBetaSpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe("LMT");
    expect(rows[0].beta).toBeCloseTo(0.85);
    expect(rows[1].beta).toBeCloseTo(-0.42);
  });
  it("dedup distinct per ticker+date", () => {
    const rows = PoliticalBetaSpec.parse(fixture as never);
    expect(PoliticalBetaSpec.dedup(rows[0])).not.toBe(PoliticalBetaSpec.dedup(rows[1]));
  });
});
