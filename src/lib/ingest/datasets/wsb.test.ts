import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/wsb.json";
import { WsbMentionSpec } from "./wsb";

describe("WsbMentionSpec", () => {
  it("parses fixture", () => {
    const rows = WsbMentionSpec.parse(fixture as never);
    expect(rows).toHaveLength(3);
    expect(rows[0].ticker).toBe("GME");
    expect(rows[0].mentions).toBe(420);
    expect(rows[0].sentiment).toBeCloseTo(0.72);
    expect(rows[0].rank).toBe(1);
  });
  it("dedup hash is stable and distinct per row", () => {
    const rows = WsbMentionSpec.parse(fixture as never);
    const a = WsbMentionSpec.dedup(rows[0]);
    const b = WsbMentionSpec.dedup(rows[2]);
    expect(a).not.toBe(b);
    expect(WsbMentionSpec.dedup(rows[0])).toBe(a);
  });
});
