import { describe, it, expect } from "vitest";
import { shapeDisclosureDelay, type DelayInput } from "./disclosureDelay";

function trade(transactionDays: number, disclosureDays: number): DelayInput {
  return {
    transactionDate: new Date(`2025-09-${String(transactionDays).padStart(2, "0")}T00:00:00Z`),
    disclosureDate: new Date(`2025-09-${String(disclosureDays).padStart(2, "0")}T00:00:00Z`),
  };
}

describe("shapeDisclosureDelay", () => {
  it("returns all buckets at zero for empty input", () => {
    const out = shapeDisclosureDelay([]);
    expect(out.map((b) => b.bucket)).toEqual(["0–7", "8–14", "15–30", "31–45", "46+"]);
    expect(out.every((b) => b.count === 0)).toBe(true);
  });

  it("places trades into the correct bucket by day delta", () => {
    const out = shapeDisclosureDelay([
      trade(1, 4), // 3 days → 0–7
      trade(1, 8), // 7 days → 0–7
      trade(1, 9), // 8 days → 8–14
      trade(1, 15), // 14 days → 8–14
      trade(1, 16), // 15 days → 15–30
      // For 31+ we need to cross months
      {
        transactionDate: new Date("2025-08-01T00:00:00Z"),
        disclosureDate: new Date("2025-09-01T00:00:00Z"),
      }, // 31 days → 31–45
      {
        transactionDate: new Date("2025-07-01T00:00:00Z"),
        disclosureDate: new Date("2025-09-01T00:00:00Z"),
      }, // 62 days → 46+
    ]);
    const counts = Object.fromEntries(out.map((b) => [b.bucket, b.count]));
    expect(counts).toEqual({
      "0–7": 2,
      "8–14": 2,
      "15–30": 1,
      "31–45": 1,
      "46+": 1,
    });
  });

  it("ignores trades with negative delay (disclosure before transaction)", () => {
    const out = shapeDisclosureDelay([trade(10, 5)]); // -5 days
    expect(out.every((b) => b.count === 0)).toBe(true);
  });

  it("preserves bucket order regardless of which buckets fill", () => {
    const out = shapeDisclosureDelay([
      {
        transactionDate: new Date("2025-07-01T00:00:00Z"),
        disclosureDate: new Date("2025-09-01T00:00:00Z"),
      }, // 46+
    ]);
    expect(out.map((b) => b.bucket)).toEqual(["0–7", "8–14", "15–30", "31–45", "46+"]);
  });
});
