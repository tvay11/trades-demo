import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SmartMoneyNetworkGraph } from "./smart-money-network-graph";

describe("SmartMoneyNetworkGraph", () => {
  it("renders an empty state when there are no smart-money links", () => {
    render(<SmartMoneyNetworkGraph nodes={[]} links={[]} />);

    expect(screen.getByText("No 13F convergence links")).toBeInTheDocument();
  });

  it("renders stock and fund nodes from the smart-money network", () => {
    render(
      <SmartMoneyNetworkGraph
        nodes={[
          { id: "stock:LONG_BUY:OSCR", label: "OSCR", kind: "stock", score: 88, signalSide: "LONG_BUY", fundCount: 5, marketCap: 6_400_000_000, sector: "Healthcare" },
          { id: "stock:LONG_SELL:BILL", label: "BILL", kind: "stock", score: 81, signalSide: "LONG_SELL", fundCount: 5, marketCap: 4_200_000_000, sector: "Technology" },
          { id: "stock:PUT_BEARISH:DNUT", label: "DNUT", kind: "stock", score: 77, signalSide: "PUT_BEARISH", fundCount: 5, marketCap: 2_700_000_000, sector: "Consumer Defensive" },
          { id: "fund:Renaissance", label: "Renaissance", kind: "fund", score: 88 },
        ]}
        links={[
          {
            source: "fund:Renaissance",
            target: "stock:LONG_BUY:OSCR",
            ticker: "OSCR",
            value: 12_500_000,
            changeShares: 50_000,
            filingDate: new Date("2026-05-15T00:00:00Z"),
            signalSide: "LONG_BUY",
          },
          {
            source: "fund:Renaissance",
            target: "stock:LONG_SELL:BILL",
            ticker: "BILL",
            value: 8_000_000,
            changeShares: -40_000,
            filingDate: new Date("2026-05-15T00:00:00Z"),
            signalSide: "LONG_SELL",
          },
          {
            source: "fund:Renaissance",
            target: "stock:PUT_BEARISH:DNUT",
            ticker: "DNUT",
            value: 4_000_000,
            changeShares: 12_000,
            filingDate: new Date("2026-05-15T00:00:00Z"),
            signalSide: "PUT_BEARISH",
          },
        ]}
      />,
    );

    expect(screen.getByText("$OSCR")).toBeInTheDocument();
    expect(screen.getByText("$BILL")).toBeInTheDocument();
    expect(screen.getByText("$DNUT")).toBeInTheDocument();
    expect(screen.getByText("Renaissance")).toBeInTheDocument();
    expect(screen.getByText("Bullish buy")).toBeInTheDocument();
    expect(screen.getByText("Sell/reduction")).toBeInTheDocument();
    expect(screen.getByText("Put exposure")).toBeInTheDocument();
  });

  it("renders stable SVG coordinates without long floating-point precision tails", () => {
    const { container } = render(
      <SmartMoneyNetworkGraph
        nodes={[
          { id: "stock:LONG_BUY:OSCR", label: "OSCR", kind: "stock", score: 88, signalSide: "LONG_BUY", fundCount: 5, marketCap: 6_400_000_000, sector: "Healthcare" },
          { id: "stock:LONG_SELL:BILL", label: "BILL", kind: "stock", score: 81, signalSide: "LONG_SELL", fundCount: 5, marketCap: 4_200_000_000, sector: "Technology" },
          { id: "stock:PUT_BEARISH:DNUT", label: "DNUT", kind: "stock", score: 77, signalSide: "PUT_BEARISH", fundCount: 5, marketCap: 2_700_000_000, sector: "Consumer Defensive" },
          { id: "fund:Renaissance", label: "Renaissance", kind: "fund", score: 88 },
          { id: "fund:Citadel", label: "Citadel", kind: "fund", score: 84 },
        ]}
        links={[
          {
            source: "fund:Renaissance",
            target: "stock:LONG_BUY:OSCR",
            ticker: "OSCR",
            value: 12_500_000,
            changeShares: 50_000,
            filingDate: new Date("2026-05-15T00:00:00Z"),
            signalSide: "LONG_BUY",
          },
          {
            source: "fund:Renaissance",
            target: "stock:LONG_SELL:BILL",
            ticker: "BILL",
            value: 8_000_000,
            changeShares: -40_000,
            filingDate: new Date("2026-05-15T00:00:00Z"),
            signalSide: "LONG_SELL",
          },
          {
            source: "fund:Citadel",
            target: "stock:PUT_BEARISH:DNUT",
            ticker: "DNUT",
            value: 4_000_000,
            changeShares: 12_000,
            filingDate: new Date("2026-05-15T00:00:00Z"),
            signalSide: "PUT_BEARISH",
          },
        ]}
      />,
    );

    const coordinateValues = [
      ...Array.from(container.querySelectorAll("line")).flatMap((line) => [
        line.getAttribute("x1"),
        line.getAttribute("y1"),
        line.getAttribute("x2"),
        line.getAttribute("y2"),
      ]),
      ...Array.from(container.querySelectorAll("g[transform]")).map((group) => group.getAttribute("transform")),
    ].filter(Boolean);

    expect(coordinateValues).toContain("translate(419.000,311.014)");
    expect(coordinateValues.join(" ")).not.toMatch(/\.\d{4,}/);
  });
});
