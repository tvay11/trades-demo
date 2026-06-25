import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/spac.json";
import { SpacSpec } from "./spac";

describe("SpacSpec", () => {
  it("parses fixture and converts trust value to cents", () => {
    const rows = SpacSpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe("SPCQ");
    expect(rows[0].trustValueCents).toBe(25_000_000_000n);
    expect(rows[1].targetTicker).toBe("FOO");
  });
  it("dedup hash is stable", () => {
    const rows = SpacSpec.parse(fixture as never);
    expect(SpacSpec.dedup(rows[0])).toBe(SpacSpec.dedup(rows[0]));
  });
});
