import { describe, expect, it } from "vitest";

import { scoreCommitteeRelevance } from "./relevance";

describe("committee relevance scoring", () => {
  it("boosts a chair trading a defense ticker from Armed Services", () => {
    const edge = scoreCommitteeRelevance({
      ticker: "LMT",
      sector: "Industrials",
      industry: "Aerospace & Defense",
      committees: [
        {
          name: "House Armed Services Committee",
          role: "Chair",
          isChair: true,
          isRanking: false,
        },
      ],
    });

    expect(edge.score).toBeGreaterThanOrEqual(90);
    expect(edge.label).toBe("High");
    expect(edge.matches).toContain("House Armed Services Committee");
    expect(edge.reasons).toContain("Committee jurisdiction matches ticker");
    expect(edge.reasons).toContain("Chair role increases committee edge");
  });

  it("detects sector-level committee relevance without a direct ticker match", () => {
    const edge = scoreCommitteeRelevance({
      ticker: "PEG",
      sector: "Utilities",
      industry: "Renewable Electricity",
      committees: [
        {
          name: "Senate Energy and Natural Resources Committee",
          role: "Member",
          isChair: false,
          isRanking: false,
        },
      ],
    });

    expect(edge.score).toBeGreaterThanOrEqual(45);
    expect(edge.label).toBe("Medium");
    expect(edge.reasons).toContain("Committee jurisdiction matches sector or industry");
  });

  it("keeps unrelated committee assignments low signal", () => {
    const edge = scoreCommitteeRelevance({
      ticker: "NVDA",
      sector: "Technology",
      industry: "Semiconductors",
      committees: [
        {
          name: "House Agriculture Committee",
          role: "Member",
          isChair: false,
          isRanking: false,
        },
      ],
    });

    expect(edge.score).toBeLessThan(20);
    expect(edge.label).toBe("Low");
  });
});
