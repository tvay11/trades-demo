import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/analysis/stocks",
}));

vi.mock("@/components/command-search", () => ({
  CommandSearch: () => null,
}));

vi.mock("@/components/sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

describe("AppShell", () => {
  it("renders the report-inspired utility frame outside report routes", () => {
    render(
      <AppShell>
        <main>Content</main>
      </AppShell>,
    );

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("ledger-util");
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search trades/i })).toHaveClass("ledger-search");
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Stocks")).toBeInTheDocument();
  });
});
