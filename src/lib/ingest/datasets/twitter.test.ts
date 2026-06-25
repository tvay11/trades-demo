import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/twitter.json";
import { TwitterMentionSpec } from "./twitter";

describe("TwitterMentionSpec", () => {
  it("parses fixture", () => {
    const rows = TwitterMentionSpec.parse(fixture as never);
    expect(rows).toHaveLength(3);
    expect(rows[0].ticker).toBe("TSLA");
    expect(rows[0].mentions).toBe(5400);
    expect(rows[0].followers).toBe(1200000);
  });
  it("dedup hash distinct per (ticker, date)", () => {
    const rows = TwitterMentionSpec.parse(fixture as never);
    expect(TwitterMentionSpec.dedup(rows[0])).not.toBe(TwitterMentionSpec.dedup(rows[2]));
  });
});
