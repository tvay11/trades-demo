import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FundamentalsCard } from "./FundamentalsCard";
import type { EdgarFundamentals } from "@/lib/ledger/types";

const fundamentals: EdgarFundamentals = {
  annual: {
    fiscalLabel: "FY2026",
    periodEnd: "2026-01-31",
    form: "10-K",
    revenue: 60_922_000_000,
    revenueYoYPct: 114.2,
    grossMarginPct: 73.5,
    netIncome: 29_760_000_000,
    netIncomeYoYPct: 145.0,
    dilutedEps: 11.93,
  },
  quarter: {
    fiscalLabel: "Q4 FY2026",
    periodEnd: "2026-01-31",
    form: "10-Q",
    revenue: 22_100_000_000,
    revenueYoYPct: 22.0,
    grossMarginPct: 74.0,
    netIncome: 12_300_000_000,
    netIncomeYoYPct: -3.0,
    dilutedEps: 4.93,
  },
};

describe("FundamentalsCard", () => {
  it("renders annual and quarter periods with revenue, margin, and EPS", () => {
    render(<FundamentalsCard fundamentals={fundamentals} />);
    expect(screen.getByText("FY2026")).toBeInTheDocument();
    expect(screen.getByText("Q4 FY2026")).toBeInTheDocument();
    expect(screen.getByText("$60.9B")).toBeInTheDocument();
    expect(screen.getByText("73.5%")).toBeInTheDocument();
    expect(screen.getByText("$11.93")).toBeInTheDocument();
  });

  it("colors a positive YoY profit and a negative YoY destructive", () => {
    const { container } = render(<FundamentalsCard fundamentals={fundamentals} />);
    expect(screen.getByText("+114.2%")).toBeInTheDocument();
    expect(screen.getByText("-3.0%")).toBeInTheDocument();
    expect(container.querySelector(".text-destructive")).not.toBeNull();
  });

  it("renders nothing when fundamentals are null", () => {
    const { container } = render(<FundamentalsCard fundamentals={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when both periods are null", () => {
    const { container } = render(
      <FundamentalsCard fundamentals={{ annual: null, quarter: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
