// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractReportSignals } from "@/lib/queries/reportSignals";

const payload = JSON.stringify({
  houseCall: { rating: "BUY" },
});

describe("extractReportSignals", () => {
  it("pulls the rating from a report payload", () => {
    const s = extractReportSignals(payload, "2026-06-10T12:00:00.000Z");
    expect(s).toMatchObject({ rating: "BUY", generatedAt: "2026-06-10T12:00:00.000Z" });
  });
  it("returns null when the rating is missing or invalid", () => {
    expect(extractReportSignals(JSON.stringify({ houseCall: {} }), "2026-06-10T12:00:00.000Z")).toBeNull();
  });
  it("returns null on unparseable payload", () => {
    expect(extractReportSignals("{nope", "2026-06-10T12:00:00.000Z")).toBeNull();
  });
});
