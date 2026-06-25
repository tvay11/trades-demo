// @vitest-environment node
import { describe, it, expect } from "vitest";
import { classifyAction } from "./classify";

describe("classifyAction", () => {
  it.each<[string | null | undefined, "buy" | "sell" | "other"]>([
    ["Purchase", "buy"],
    ["Buy", "buy"],
    ["purchase", "buy"],
    ["BUY", "buy"],
    ["Sale", "sell"],
    ["Sale (Full)", "sell"],
    ["Sale (Partial)", "sell"],
    ["Sell", "sell"],
    ["sale", "sell"],
    ["Exchange", "other"],
    // SEC Form 4 codes used by InsiderTrade.transactionType
    ["P", "buy"],
    ["P/A", "buy"],
    ["p/a", "buy"],
    ["S", "sell"],
    ["S/D", "sell"],
    // Non-directional Form 4 codes (option exercise, gift, bare A/D)
    ["M/A", "other"],
    ["G/D", "other"],
    ["A", "other"],
    ["D", "other"],
    ["", "other"],
    [null, "other"],
    [undefined, "other"],
  ])("%p -> %s", (input, expected) => {
    expect(classifyAction(input)).toBe(expected);
  });
});
