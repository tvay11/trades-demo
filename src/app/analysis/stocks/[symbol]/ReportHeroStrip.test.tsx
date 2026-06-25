import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportHeroStrip } from "./ReportHeroStrip";
import type { Ledger } from "@/lib/ledger/types";

const ledger = {
  ticker: "NVDA",
  generatedAt: "2026-06-10T12:00:00.000Z",
  houseCall: { rating: "BUY", score: 3, drivers: [], watchTrigger: "", synthesis: "", contributions: [] },
} as unknown as Ledger;

describe("ReportHeroStrip", () => {
  it("renders rating and age from the snapshot, without a forecast figure", () => {
    render(<ReportHeroStrip report={ledger} now={new Date("2026-06-11T12:00:00.000Z")} />);
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.queryByText(/Forecast/)).not.toBeInTheDocument();
    expect(screen.getByText(/1d old/)).toBeInTheDocument();
  });
  it("shows STALE chip past 7 days", () => {
    render(<ReportHeroStrip report={ledger} now={new Date("2026-06-20T12:00:00.000Z")} />);
    expect(screen.getByText("STALE")).toBeInTheDocument();
  });
  it("renders nothing without a report", () => {
    const { container } = render(<ReportHeroStrip report={null} now={new Date()} />);
    expect(container.firstChild).toBeNull();
  });
});
