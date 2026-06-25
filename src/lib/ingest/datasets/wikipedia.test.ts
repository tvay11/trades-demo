import { describe, it, expect } from "vitest";
import fixture from "@/test/fixtures/quiver/wikipedia.json";
import { WikipediaViewSpec } from "./wikipedia";

describe("WikipediaViewSpec", () => {
  it("parses fixture", () => {
    const rows = WikipediaViewSpec.parse(fixture as never);
    expect(rows).toHaveLength(2);
    expect(rows[0].ticker).toBe("AAPL");
    expect(rows[0].views).toBe(12345);
  });
  it("dedup hash distinct per (ticker, date)", () => {
    const rows = WikipediaViewSpec.parse(fixture as never);
    expect(WikipediaViewSpec.dedup(rows[0])).not.toBe(WikipediaViewSpec.dedup(rows[1]));
  });
});
