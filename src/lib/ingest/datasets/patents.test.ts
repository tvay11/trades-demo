import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/patents.json";
import { PatentSpec } from "./patents";

describe("PatentSpec", () => {
  it("parses fixture and joins inventor arrays into comma string", () => {
    const rows = PatentSpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].inventors).toBe("Alice Smith, Bob Lee");
    expect(rows[1].inventors).toBe("Carol Doe");
    expect(rows[0].patentNumber).toBe("US12345678");
  });
  it("dedup distinct per patent", () => {
    const rows = PatentSpec.parse(fixture as never);
    expect(PatentSpec.dedup(rows[0])).not.toBe(PatentSpec.dedup(rows[1]));
  });
});
