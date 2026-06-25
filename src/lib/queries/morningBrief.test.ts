// @vitest-environment node
import { describe, expect, it } from "vitest";
import { diffReportSignals } from "./morningBrief";

const sig = (rating: string) =>
  ({ rating, generatedAt: "2026-06-12" }) as never;

describe("diffReportSignals", () => {
  it("flags rating changes", () => {
    expect(diffReportSignals(sig("BUY"), sig("HOLD"))).toBe("rating");
  });
  it("null when unchanged or no previous", () => {
    expect(diffReportSignals(sig("HOLD"), sig("HOLD"))).toBeNull();
    expect(diffReportSignals(sig("HOLD"), null)).toBeNull();
  });
});
