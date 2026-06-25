import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AltFlowMoversSection } from "./AltFlowMoversSection";
import type { AltFlowMovers } from "@/lib/queries/altFlowMovers";

const empty: AltFlowMovers = { wsbSurges: [], darkShortSpikes: [], govContracts: [] };

function makeMovers(): AltFlowMovers {
  return {
    wsbSurges: [
      { ticker: "GME", mentions7d: 500, mentionsPrior7d: 100, surgeRatio: 5.0 },
      { ticker: "AMC", mentions7d: 200, mentionsPrior7d: 50,  surgeRatio: 4.0 },
    ],
    darkShortSpikes: [
      { ticker: "NVDA", latestShortVolPct: 42.3, excessPp: 12.5 },
    ],
    govContracts: [
      { ticker: "LMT", agency: "Department of Defense", amountUsd: 5_000_000, date: "2026-06-01" },
    ],
  };
}

describe("AltFlowMoversSection", () => {
  it("renders all three columns with ticker links and key stats", () => {
    render(<AltFlowMoversSection movers={makeMovers()} />);

    // WSB surges
    const gmeLink = screen.getByRole("link", { name: /\$GME/i });
    expect(gmeLink).toBeInTheDocument();
    expect(gmeLink).toHaveAttribute("href", "/analysis/stocks/GME");
    expect(screen.getByText("×5.0")).toBeInTheDocument();

    // Dark short spikes
    const nvdaLink = screen.getByRole("link", { name: /\$NVDA/i });
    expect(nvdaLink).toBeInTheDocument();
    expect(nvdaLink).toHaveAttribute("href", "/analysis/stocks/NVDA");
    expect(screen.getByText("+12.5pp")).toBeInTheDocument();

    // Gov contracts
    const lmtLink = screen.getByRole("link", { name: /\$LMT/i });
    expect(lmtLink).toBeInTheDocument();
    expect(lmtLink).toHaveAttribute("href", "/analysis/stocks/LMT");
    expect(screen.getByText("$5.0M")).toBeInTheDocument();

    // Column headers
    expect(screen.getByText("WSB Surges")).toBeInTheDocument();
    expect(screen.getByText("Dark Short Spikes")).toBeInTheDocument();
    expect(screen.getByText("Gov Contracts")).toBeInTheDocument();
  });

  it("returns null when all three columns are empty", () => {
    const { container } = render(<AltFlowMoversSection movers={empty} />);
    expect(container.firstChild).toBeNull();
  });
});
