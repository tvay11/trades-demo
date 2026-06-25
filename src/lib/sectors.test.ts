import { describe, it, expect } from "vitest";
import { sectorOf } from "./sectors";

describe("sectorOf", () => {
  it("returns the mapped sector for a known ticker", () => {
    expect(sectorOf("NVDA")).toBe("Information Technology");
  });

  it("is case-insensitive", () => {
    expect(sectorOf("nvda")).toBe("Information Technology");
    expect(sectorOf("Nvda")).toBe("Information Technology");
  });

  it("trims whitespace", () => {
    expect(sectorOf(" AAPL ")).toBe("Information Technology");
  });

  it("returns 'Unknown' for an unknown ticker", () => {
    expect(sectorOf("ZZZZZQ")).toBe("Unknown");
  });

  it("returns 'Unknown' for empty input", () => {
    expect(sectorOf("")).toBe("Unknown");
  });

  it("covers a few well-known names across sectors", () => {
    expect(sectorOf("JPM")).toBe("Financials");
    expect(sectorOf("XOM")).toBe("Energy");
    expect(sectorOf("JNJ")).toBe("Health Care");
    expect(sectorOf("AMZN")).toBe("Consumer Discretionary");
  });
});
