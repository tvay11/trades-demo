import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatasetTable } from "@/components/datasets/dataset-table";
import { FilterPills } from "@/components/filter-pills";
import { StatCard } from "@/components/stat-card";
import type { DatasetDefinition } from "@/lib/datasets/registry";
import type { NormalizedDatasetQuery } from "@/lib/datasets/filters";

vi.mock("@/components/use-count-up", () => ({
  useCountUp: (target: number) => ({ value: target, ref: { current: null } }),
}));

const datasetDefinition: DatasetDefinition = {
  slug: "stocks",
  label: "Stocks",
  tableName: "Stock",
  group: "Reference",
  description: "Tracked stocks",
  columns: [
    { key: "ticker", label: "Ticker", kind: "ticker" },
    { key: "companyName", label: "Company", kind: "text" },
    { key: "marketCap", label: "Market cap", kind: "cents" },
  ],
  searchableColumns: ["ticker", "companyName"],
  defaultSort: { key: "ticker", dir: "asc" },
  filterGroups: [],
  filters: [],
};

const datasetQuery: NormalizedDatasetQuery = {
  search: "",
  page: 1,
  sort: { key: "ticker", dir: "asc" },
  filters: {},
};

describe("high-traffic ledger components", () => {
  it("keeps filter pill hrefs while applying the ledger filter strip treatment", () => {
    render(
      <FilterPills
        options={[
          { value: "all", label: "All" },
          { value: "buy", label: "Buy" },
        ]}
        active="buy"
        paramName="side"
        basePath="/trades"
        searchParams={{ q: "aapl", page: "2", side: "sell" }}
      />,
    );

    expect(screen.getByTestId("filter-pills")).toHaveClass("ledger-filter-strip");
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/trades?q=aapl&page=2");
    expect(screen.getByRole("link", { name: "Buy" })).toHaveAttribute("href", "/trades?q=aapl&page=2&side=buy");
  });

  it("keeps stat card numeric output while applying ledger panel styling", () => {
    render(
      <StatCard
        label="New filings"
        value={1234}
        iconName="bar-chart"
        change="+12%"
        changeType="positive"
      />,
    );

    expect(screen.getByTestId("stat-card")).toHaveClass("ledger-callout");
    expect(screen.getByText("New filings")).toHaveClass("data-label");
    expect(screen.getByText("1.2k")).toHaveClass("data-value");
    expect(screen.getByText("+12%")).toHaveClass("text-sky-500");
  });

  it("keeps dataset table sort and ticker links while using ledger table shells", () => {
    render(
      <DatasetTable
        definition={datasetDefinition}
        rows={[{ id: "aapl", ticker: "AAPL", companyName: "Apple Inc.", marketCap: 1000000 }]}
        basePath="/datasets/stocks"
        query={datasetQuery}
      />,
    );

    expect(screen.getByTestId("dataset-table-shell")).toHaveClass("qq-table-shell");
    expect(screen.getAllByRole("link", { name: "$AAPL" })).toHaveLength(2);
    for (const tickerLink of screen.getAllByRole("link", { name: "$AAPL" })) {
      expect(tickerLink).toHaveAttribute("href", "/analysis/stocks/AAPL");
    }
    expect(screen.getByRole("link", { name: /Ticker/i })).toHaveAttribute(
      "href",
      "/datasets/stocks?sort=ticker&dir=desc",
    );
  });
});
