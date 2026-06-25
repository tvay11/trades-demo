// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseTradeId } from "./parseId";

describe("parseTradeId", () => {
  it("parses cong- prefix", () => {
    expect(parseTradeId("cong-42")).toEqual({ branch: "congress", numericId: 42 });
  });
  it("parses exec- prefix", () => {
    expect(parseTradeId("exec-7")).toEqual({ branch: "executive", numericId: 7 });
  });
  it("accepts bare numeric ids as legacy congress", () => {
    expect(parseTradeId("123")).toEqual({ branch: "congress", numericId: 123 });
  });
  it("rejects garbage", () => {
    expect(parseTradeId("")).toBeNull();
    expect(parseTradeId("abc")).toBeNull();
    expect(parseTradeId("cong-")).toBeNull();
    expect(parseTradeId("cong-abc")).toBeNull();
    expect(parseTradeId("sen-123")).toBeNull();
  });
});
