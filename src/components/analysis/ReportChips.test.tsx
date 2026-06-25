import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportChips } from "./ReportChips";

describe("ReportChips", () => {
  it("renders the rating stamp and no forecast figure", () => {
    render(<ReportChips signals={{ rating: "BUY", generatedAt: "2026-06-10T12:00:00.000Z" }} />);
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
  it("renders nothing when signals are missing", () => {
    const { container } = render(<ReportChips signals={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
