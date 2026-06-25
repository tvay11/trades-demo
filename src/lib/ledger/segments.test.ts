import { describe, expect, it } from "vitest";
import { extractSegmentNote, parseSegmentBreakdown } from "./segments";

describe("extractSegmentNote", () => {
  it("pulls a window around the segment-reporting heading", () => {
    const doc = "intro ".repeat(50) + "<p>Segment Information</p> Data Center 115000 Gaming 11400 " + "tail ".repeat(50);
    const out = extractSegmentNote(doc);
    expect(out).toContain("Data Center");
    expect(out).toContain("Gaming");
  });
  it("returns null when no segment heading exists", () => {
    expect(extractSegmentNote("nothing relevant here")).toBeNull();
  });
});

describe("parseSegmentBreakdown", () => {
  it("sorts by revenue, computes share%, reconciles to total revenue", () => {
    const out = parseSegmentBreakdown(
      JSON.stringify({ fiscalLabel: "FY2025", note: "Data Center dominates.", segments: [
        { name: "Gaming", revenue: 11400, revenuePriorYear: 10000 },
        { name: "Data Center", revenue: 115200, revenuePriorYear: 47500 },
      ] }),
      130497,
    );
    expect(out).not.toBeNull();
    expect(out!.segments[0].name).toBe("Data Center");
    expect(out!.segments[0].sharePct).toBeCloseTo(91.0, 0);
    expect(out!.segments[0].yoyPct).toBeCloseTo(142.5, 0);
    expect(out!.reconciledPct).toBeCloseTo(97, 0);
  });
  it("returns null when there are fewer than 2 segments", () => {
    expect(parseSegmentBreakdown(JSON.stringify({ segments: [{ name: "All", revenue: 100 }] }), 100)).toBeNull();
  });
  it("returns null on malformed JSON", () => {
    expect(parseSegmentBreakdown("not json", 100)).toBeNull();
  });
  it("tolerates markdown-fenced JSON", () => {
    const fenced = "```json\n" + JSON.stringify({ segments: [
      { name: "A", revenue: 60 }, { name: "B", revenue: 40 },
    ] }) + "\n```";
    const out = parseSegmentBreakdown(fenced, 100);
    expect(out).not.toBeNull();
    expect(out!.segments).toHaveLength(2);
    expect(out!.reconciledPct).toBeCloseTo(100, 0);
  });
  it("normalizes segment revenue in millions to a full-dollar total", () => {
    // segments reported in millions; total revenue in full dollars
    const out = parseSegmentBreakdown(
      JSON.stringify({ segments: [
        { name: "Data Center", revenue: 115200 },
        { name: "Gaming", revenue: 11400 },
      ] }),
      130_497_000_000, // ~130.5B in full dollars
    );
    expect(out).not.toBeNull();
    // sum of segments (126,600 million ≈ 126.6B) should reconcile to ~97% of 130.5B
    expect(out!.reconciledPct).toBeCloseTo(97, 0);
    // and the displayed segment revenue should be scaled up to full dollars
    expect(out!.segments[0].revenue).toBeCloseTo(115_200_000_000, -6); // ~115.2B
  });
});
