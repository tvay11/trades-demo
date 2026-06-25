import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyTickersSection } from "./MyTickersSection";
import type { MorningBriefRow } from "@/lib/queries/morningBrief";

function makeRow(overrides: Partial<MorningBriefRow> = {}): MorningBriefRow {
  return {
    ticker: "AAPL",
    price: 195.5,
    changePct: 1.23,
    signals: {
      rating: "BUY",
      generatedAt: "2026-06-10",
    },
    changed: null,
    reportAgeDays: 2,
    ...overrides,
  };
}

describe("MyTickersSection", () => {
  it("renders ticker link and report chips", () => {
    render(<MyTickersSection rows={[makeRow()]} />);
    const link = screen.getByRole("link", { name: /\$AAPL/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/report/AAPL");
    // ReportChips renders the rating chip
    expect(screen.getByText("BUY")).toBeInTheDocument();
  });

  it("renders CHANGED chip when changed is non-null", () => {
    render(<MyTickersSection rows={[makeRow({ changed: "rating" })]} />);
    expect(screen.getByText("CHANGED")).toBeInTheDocument();
    const chip = screen.getByText("CHANGED");
    expect(chip).toHaveAttribute("title", "rating changed vs previous report");
  });

  it("renders STALE chip when reportAgeDays > 7", () => {
    render(<MyTickersSection rows={[makeRow({ reportAgeDays: 10 })]} />);
    expect(screen.getByText("STALE")).toBeInTheDocument();
  });

  it("does not render STALE chip when reportAgeDays <= 7", () => {
    render(<MyTickersSection rows={[makeRow({ reportAgeDays: 5 })]} />);
    expect(screen.queryByText("STALE")).toBeNull();
  });

  it("renders price and day change", () => {
    render(<MyTickersSection rows={[makeRow()]} />);
    expect(screen.getByText(/195/)).toBeInTheDocument();
    expect(screen.getByText(/\+1\.23%/)).toBeInTheDocument();
  });

  it("hides when rows array is empty", () => {
    const { container } = render(<MyTickersSection rows={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders dash for null price and changePct", () => {
    render(<MyTickersSection rows={[makeRow({ price: null, changePct: null })]} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
