import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewIdeasSection } from "./NewIdeasSection";
import type { NewIdeas } from "@/lib/queries/morningBrief";

const emptyIdeas: NewIdeas = { longs: [], shorts: [] };

function makeIdeas(): NewIdeas {
  return {
    longs: [
      { ticker: "AAPL", stance: "Long", score: 72, conviction: null },
      { ticker: "MSFT", stance: "Long", score: 65, conviction: null },
    ],
    shorts: [
      { ticker: "TSLA", stance: "Short", score: 58, conviction: null },
    ],
  };
}

describe("NewIdeasSection", () => {
  it("renders long and short tickers with links and scores", () => {
    render(<NewIdeasSection ideas={makeIdeas()} />);
    const aaplLink = screen.getByRole("link", { name: /\$AAPL/i });
    expect(aaplLink).toBeInTheDocument();
    expect(aaplLink).toHaveAttribute("href", "/analysis/stocks/AAPL");

    const tslaLink = screen.getByRole("link", { name: /\$TSLA/i });
    expect(tslaLink).toBeInTheDocument();
    expect(tslaLink).toHaveAttribute("href", "/analysis/stocks/TSLA");

    // Scores are rendered
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("58")).toBeInTheDocument();

    // Column headers
    expect(screen.getByText("LONG")).toBeInTheDocument();
    expect(screen.getByText("SHORT")).toBeInTheDocument();
  });

  it("hides when both longs and shorts are empty", () => {
    const { container } = render(<NewIdeasSection ideas={emptyIdeas} />);
    expect(container.firstChild).toBeNull();
  });
});
