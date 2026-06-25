import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketTapeStrip } from "./MarketTapeStrip";
import type { TapeCell } from "@/lib/queries/marketTape";
import type { MacroRegime } from "@/lib/ledger/types";

const cell = (symbol: string, label: string, price: number, changePct: number | null): TapeCell => ({
  symbol,
  label,
  price,
  changePct,
});

const macro: MacroRegime = {
  asOf: "2026-06-12",
  score: 45,
  label: "risk-on",
  factors: [],
  note: "Risk-on regime",
  confidence: "ok",
};

describe("MarketTapeStrip", () => {
  it("renders a cell label and formatted price", () => {
    render(
      <MarketTapeStrip
        cells={[cell("^GSPC", "S&P 500", 5999.12, 0.42)]}
        macro={null}
      />,
    );
    expect(screen.getByText("S&P 500")).toBeInTheDocument();
    // price ≥ 10 → toLocaleString with ≤2 decimals — just check it's in the doc
    expect(screen.getByText(/5[,.]?999/)).toBeInTheDocument();
  });

  it("renders signed change percent", () => {
    render(
      <MarketTapeStrip
        cells={[cell("^GSPC", "S&P 500", 6000, 1.23)]}
        macro={null}
      />,
    );
    expect(screen.getByText(/\+1\.23%/)).toBeInTheDocument();
  });

  it("renders negative change percent", () => {
    render(
      <MarketTapeStrip
        cells={[cell("^VIX", "VIX", 18.5, -2.1)]}
        macro={null}
      />,
    );
    expect(screen.getByText(/-2\.10%/)).toBeInTheDocument();
  });

  it("hides changePct cell when changePct is null", () => {
    const { container } = render(
      <MarketTapeStrip
        cells={[cell("^GSPC", "S&P 500", 6000, null)]}
        macro={null}
      />,
    );
    expect(container.querySelector(".change-pct")).toBeNull();
  });

  it("formats small prices (< 10) with 2 decimals", () => {
    render(
      <MarketTapeStrip
        cells={[cell("^VIX", "VIX", 7.45, null)]}
        macro={null}
      />,
    );
    expect(screen.getByText("7.45")).toBeInTheDocument();
  });

  it("renders macro regime chip when macro is provided", () => {
    render(
      <MarketTapeStrip cells={[cell("^GSPC", "S&P 500", 6000, 0.5)]} macro={macro} />,
    );
    expect(screen.getByText(/risk-on/i)).toBeInTheDocument();
  });

  it("returns null (renders nothing) when cells empty and macro null", () => {
    const { container } = render(
      <MarketTapeStrip cells={[]} macro={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("still renders when cells empty but macro is provided", () => {
    const { container } = render(
      <MarketTapeStrip cells={[]} macro={macro} />,
    );
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByText(/risk-on/i)).toBeInTheDocument();
  });
});
