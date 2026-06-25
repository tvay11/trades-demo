import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardChartFallback } from "./dashboard-chart-islands";

describe("DashboardChartFallback", () => {
  it("renders a stable labeled chart placeholder", () => {
    render(
      <DashboardChartFallback
        label="Monthly Disclosure Volume"
        className="h-[280px]"
      />,
    );

    expect(screen.getByTestId("dashboard-chart-fallback")).toBeInTheDocument();
    expect(screen.getByText("Monthly Disclosure Volume")).toBeInTheDocument();
  });
});
