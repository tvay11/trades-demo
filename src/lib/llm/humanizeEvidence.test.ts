import { describe, it, expect } from "vitest";
import { humanizeEvidence } from "./humanizeEvidence";

describe("humanizeEvidence", () => {
  it("rounds long decimals", () => {
    expect(humanizeEvidence("probUp 18.906716080401285")).toBe("P(up) 18.9%");
    expect(humanizeEvidence("revenueYoYPct -2.9306991503736306")).toBe("revenue −2.9% YoY");
    expect(humanizeEvidence("grossMarginPct 21.083664626792334")).toBe("gross margin 21.1%");
  });
  it("strips field prefixes", () => {
    expect(humanizeEvidence("news title: 'Tesla EV Sales Jump'")).toBe("Tesla EV Sales Jump");
    expect(humanizeEvidence("lobbying issue: 'Autonomous Vehicle policies'")).toBe("Autonomous Vehicle policies");
  });
  it("passes through already-clean text", () => {
    expect(humanizeEvidence("MACD histogram −4.46 (bearish)")).toBe("MACD histogram −4.46 (bearish)");
  });
});
