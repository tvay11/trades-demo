import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AnalystAnalysis } from "@/lib/ledger/types";

import { AnalystAnalysisSection } from "./AnalystAnalysisSection";

const analysis: AnalystAnalysis = {
  schemaVersion: 1,
  headline: "Technicals support the rating, but risk remains visible",
  thesis: "Momentum is constructive while news risk keeps conviction measured.",
  lensReads: [
    {
      lens: "technicals",
      posture: "bullish",
      summary: "Technicals point higher.",
      evidence: ["MACD bullish"],
    },
    {
      lens: "news",
      posture: "mixed",
      summary: "News is split.",
      evidence: ["newsSkew 0.1"],
    },
  ],
  takeaways: [
    { kind: "support", label: "Support", text: "Technicals and momentum help." },
    { kind: "risk", label: "Risk", text: "News could pressure the setup." },
    { kind: "watch", label: "Watch", text: "Watch technicals deterioration." },
  ],
  keyTension: "Positive direction with visible uncertainty.",
  whatWouldChange: "A lower forecast path would weaken the view.",
};

describe("AnalystAnalysisSection", () => {
  it("adds tone classes from the structured analyst JSON", () => {
    const { container } = render(
      <AnalystAnalysisSection analysis={analysis} legacyNote={null} />,
    );

    expect(screen.getByRole("heading", { name: analysis.headline })).toHaveClass("analyst-headline");
    expect(screen.getByText(analysis.thesis)).toHaveClass("analyst-thesis");

    expect(screen.getByText("technicals").closest(".lens-card")).toHaveClass("lens-bullish");
    expect(screen.getByText("news").closest(".lens-card")).toHaveClass("lens-mixed");

    expect(container.querySelector(".takeaway-support")).toHaveTextContent("Technicals and momentum help.");
    expect(container.querySelector(".takeaway-risk")).toHaveTextContent("News could pressure the setup.");
    expect(container.querySelector(".takeaway-watch")).toHaveTextContent("Watch technicals deterioration.");

    expect(screen.getByRole("heading", { name: "Key tension" }).closest(".report-callout")).toHaveClass(
      "report-callout-mixed",
      "analyst-key-tension",
    );
    expect(screen.getByRole("heading", { name: "What would change" }).closest(".report-callout")).toHaveClass(
      "report-callout-watch",
      "analyst-what-would-change",
    );
  });
});
