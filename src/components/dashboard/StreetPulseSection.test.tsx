import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreetPulseSection } from "./StreetPulseSection";
import type { StreetPulse } from "@/lib/queries/streetPulse";

const emptyPulse: StreetPulse = { gainers: [], losers: [], actives: [], sectors: [] };

function makePulse(): StreetPulse {
  return {
    gainers: [{ ticker: "AAPL", name: "Apple Inc.", price: 210.5, changePct: 3.42 }],
    losers: [{ ticker: "TSLA", name: "Tesla, Inc.", price: 182.3, changePct: -2.15 }],
    actives: [{ ticker: "NVDA", name: "NVIDIA Corporation", price: 875.0, changePct: 1.1 }],
    sectors: [
      { symbol: "XLK", changePct: 1.2 },
      { symbol: "XLE", changePct: -2.5 },
      { symbol: "XLF", changePct: null },
    ],
  };
}

describe("StreetPulseSection", () => {
  it("renders a gainer ticker link and price with sector cell", () => {
    render(<StreetPulseSection pulse={makePulse()} />);

    const aaplLink = screen.getByRole("link", { name: /\$AAPL/i });
    expect(aaplLink).toBeInTheDocument();
    expect(aaplLink).toHaveAttribute("href", "/analysis/stocks/AAPL");

    // Sector symbol label
    expect(screen.getByText("XLK")).toBeInTheDocument();
    expect(screen.getByText("XLE")).toBeInTheDocument();

    // Column headers
    expect(screen.getByText("Gainers")).toBeInTheDocument();
    expect(screen.getByText("Losers")).toBeInTheDocument();
    expect(screen.getByText("Most Active")).toBeInTheDocument();
  });

  it("renders loser with negative change", () => {
    render(<StreetPulseSection pulse={makePulse()} />);

    const tslaLink = screen.getByRole("link", { name: /\$TSLA/i });
    expect(tslaLink).toBeInTheDocument();
    expect(tslaLink).toHaveAttribute("href", "/analysis/stocks/TSLA");

    // Negative pct rendered
    expect(screen.getByText("-2.15%")).toBeInTheDocument();
  });

  it("hides when everything is empty", () => {
    const { container } = render(<StreetPulseSection pulse={emptyPulse} />);
    expect(container.firstChild).toBeNull();
  });
});
