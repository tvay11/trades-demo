import { describe, expect, it } from "vitest";

import { buildRiskShiftPrompt, extractItem1A, parseRiskShift } from "./riskShift";

// ── extractItem1A ────────────────────────────────────────────────────────────

describe("extractItem1A", () => {
  it("finds the LAST 'Item 1A' occurrence (TOC mention comes first)", () => {
    const toc = "Table of Contents ... Item 1A. Risk Factors ... Item 1B.";
    const realSection =
      "Item 1A. Risk Factors\n" +
      "A".repeat(600) +
      "\nItem 1B. Unresolved Staff Comments";
    const doc = `<html>${toc}${realSection}</html>`;
    const result = extractItem1A(doc);
    expect(result).not.toBeNull();
    // Should include the real section content, not the TOC line
    expect(result!.length).toBeGreaterThanOrEqual(500);
  });

  it("returns null when extracted section is < 500 chars", () => {
    const doc = "Item 1A Risk Factors\nShort text.\nItem 1B.";
    expect(extractItem1A(doc)).toBeNull();
  });

  it("strips HTML tags and entities", () => {
    const body = "X".repeat(600);
    const doc = `<p><b>Item 1A.</b> Risk Factors</p><p>${body}</p><p>Item 1B.</p>`;
    const result = extractItem1A(doc);
    expect(result).not.toBeNull();
    expect(result).not.toMatch(/<[^>]+>/);
  });

  it("truncates to 12000 chars", () => {
    const body = "Y".repeat(15_000);
    const doc = `Item 1A Risk Factors\n${body}\nItem 1B Unresolved`;
    const result = extractItem1A(doc);
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(12_000);
  });
});

// ── buildRiskShiftPrompt ─────────────────────────────────────────────────────

describe("buildRiskShiftPrompt", () => {
  it("includes company, labels, and both text blocks", () => {
    const prompt = buildRiskShiftPrompt("Apple", "10-K 2024-11-01", "10-K 2025-11-01", "prev risk text", "curr risk text");
    expect(prompt).toMatch(/Apple/);
    expect(prompt).toMatch(/10-K 2024-11-01/);
    expect(prompt).toMatch(/10-K 2025-11-01/);
    expect(prompt).toMatch(/prev risk text/);
    expect(prompt).toMatch(/curr risk text/);
    expect(prompt).toMatch(/newRisks/);
    expect(prompt).toMatch(/removedRisks/);
    expect(prompt).toMatch(/shiftSummary/);
  });
});

// ── parseRiskShift ───────────────────────────────────────────────────────────

describe("parseRiskShift", () => {
  it("parses valid JSON with all fields", () => {
    const json = JSON.stringify({
      newRisks: ["AI competition", "regulatory headwinds"],
      removedRisks: ["supply chain bottleneck"],
      shiftSummary: "Risk language shifted toward AI competition.",
    });
    const result = parseRiskShift(json, "10-K 2024-11-01", "10-K 2025-11-01");
    expect(result).not.toBeNull();
    expect(result!.newRisks).toEqual(["AI competition", "regulatory headwinds"]);
    expect(result!.removedRisks).toEqual(["supply chain bottleneck"]);
    expect(result!.shiftSummary).toBe("Risk language shifted toward AI competition.");
    expect(result!.fromFiling).toBe("10-K 2024-11-01");
    expect(result!.toFiling).toBe("10-K 2025-11-01");
  });

  it("strips markdown code fences", () => {
    const json = '```json\n{"newRisks":["a","b"],"removedRisks":[],"shiftSummary":"Summary."}\n```';
    expect(parseRiskShift(json, "a", "b")).not.toBeNull();
  });

  it("caps newRisks at 5 and removedRisks at 3", () => {
    const json = JSON.stringify({
      newRisks: ["a", "b", "c", "d", "e", "f", "g"],
      removedRisks: ["x", "y", "z", "w"],
      shiftSummary: "Summary.",
    });
    const result = parseRiskShift(json, "a", "b")!;
    expect(result.newRisks).toHaveLength(5);
    expect(result.removedRisks).toHaveLength(3);
  });

  it("returns null when shiftSummary is empty or missing", () => {
    const json1 = JSON.stringify({ newRisks: [], removedRisks: [], shiftSummary: "" });
    const json2 = JSON.stringify({ newRisks: [], removedRisks: [] });
    expect(parseRiskShift(json1, "a", "b")).toBeNull();
    expect(parseRiskShift(json2, "a", "b")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseRiskShift("not json", "a", "b")).toBeNull();
  });
});
