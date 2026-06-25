import { describe, it, expect } from "vitest";
import { buildRationalePrompt } from "./rationale";

const sampleIdeas = [
  {
    ticker: "NVDA",
    companyName: "NVIDIA Corporation",
    tradeCount90: 42,
    tradeCount14: 18,
    accel: 11.5,
    tags: ["heating up", "high activity"],
  },
  {
    ticker: "TSLA",
    companyName: "Tesla Inc",
    tradeCount90: 8,
    tradeCount14: 1,
    accel: -0.2,
    tags: ["high activity"],
  },
];

describe("buildRationalePrompt", () => {
  it("includes all tickers in the prompt", () => {
    const prompt = buildRationalePrompt(sampleIdeas);
    expect(prompt).toContain("NVDA");
    expect(prompt).toContain("TSLA");
  });

  it("asks for JSON output", () => {
    const prompt = buildRationalePrompt(sampleIdeas);
    expect(prompt.toLowerCase()).toContain("json");
  });

  it("includes trade activity signals", () => {
    const prompt = buildRationalePrompt(sampleIdeas);
    expect(prompt).toContain("90d=42");
    expect(prompt).toContain("14d=18");
  });

  it("does not reference a price forecast", () => {
    const prompt = buildRationalePrompt(sampleIdeas);
    expect(prompt).not.toContain("P(up)");
    expect(prompt.toLowerCase()).not.toContain("forecast");
  });

  it("handles empty ideas array gracefully", () => {
    const prompt = buildRationalePrompt([]);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });
});
