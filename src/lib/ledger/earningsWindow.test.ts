// @vitest-environment node

import { describe, expect, it } from "vitest";
import { earningsInsideWindow } from "./earningsWindow";

describe("earningsInsideWindow", () => {
  it("true when earnings fall inside the expiry window", () => {
    expect(earningsInsideWindow(43, 60)).toBe(true);
    expect(earningsInsideWindow(0, 30)).toBe(true);
  });
  it("false when outside, unknown, or in the past", () => {
    expect(earningsInsideWindow(65, 60)).toBe(false);
    expect(earningsInsideWindow(-49, 60)).toBe(false);
    expect(earningsInsideWindow(null, 60)).toBe(false);
    expect(earningsInsideWindow(20, null)).toBe(false);
  });
});
