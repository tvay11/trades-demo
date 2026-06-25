import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportCallout } from "./ReportCallout";

describe("ReportCallout", () => {
  it("renders a titled tone block for report commentary", () => {
    render(
      <ReportCallout title="Key tension" tone="mixed" className="analyst-key-tension">
        <p>The forecast is strongly bullish, but technicals and news are bearish.</p>
      </ReportCallout>,
    );

    const callout = screen.getByRole("heading", { name: "Key tension" }).closest(".report-callout");

    expect(callout).toHaveClass("report-callout-mixed");
    expect(callout).toHaveClass("analyst-key-tension");
    expect(callout).toHaveTextContent("technicals and news are bearish");
  });
});
