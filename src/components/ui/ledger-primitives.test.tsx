import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignalPill } from "@/components/analysis/market-signal-ui";
import { TradeBranchBadge } from "@/components/trade-branch-badge";
import { TradeTypeBadge } from "@/components/trade-badges";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardHeader, CardTitle } from "./card";
import { Command, CommandDialog, CommandEmpty, CommandInput } from "./command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "./dropdown-menu";
import { Input } from "./input";
import { Popover, PopoverContent } from "./popover";
import { AppSelect } from "./select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

describe("ledger-inspired shared primitives", () => {
  it("applies the ledger panel treatment to cards", () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Signal Card</CardTitle>
        </CardHeader>
      </Card>,
    );

    expect(screen.getByTestId("card")).toHaveClass("ledger-callout");
  });

  it("applies the ledger control treatment to buttons", () => {
    render(<Button>Run scan</Button>);

    expect(screen.getByRole("button", { name: "Run scan" })).toHaveClass("ledger-stamp");
  });

  it("applies the ledger field treatment to text inputs and select triggers", () => {
    render(
      <div>
        <Input aria-label="Ticker" />
        <AppSelect
          defaultValue="desc"
          options={[
            { label: "Descending", value: "desc" },
            { label: "Ascending", value: "asc" },
          ]}
        />
      </div>,
    );

    expect(screen.getByLabelText("Ticker")).toHaveClass("ledger-field");
    expect(screen.getByRole("combobox")).toHaveClass("ledger-field");
  });

  it("applies the ledger menu treatment to command, dropdown, and popover surfaces", () => {
    render(
      <div>
        <Command data-testid="command">
          <CommandInput aria-label="Search commands" />
          <CommandEmpty>No command</CommandEmpty>
        </Command>
        <DropdownMenu open>
          <DropdownMenuContent data-testid="dropdown-menu">
            <DropdownMenuItem>Rows</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open>
          <PopoverContent data-testid="popover-menu">Calendar</PopoverContent>
        </Popover>
      </div>,
    );

    expect(screen.getByTestId("command")).toHaveClass("ledger-menu");
    expect(screen.getByTestId("dropdown-menu")).toHaveClass("ledger-menu");
    expect(screen.getByTestId("popover-menu")).toHaveClass("ledger-menu");
  });

  it("applies the ledger menu treatment to command dialogs", () => {
    render(
      <CommandDialog open>
        <CommandInput aria-label="Search" />
        <CommandEmpty>No result</CommandEmpty>
      </CommandDialog>,
    );

    expect(screen.getByRole("dialog")).toHaveClass("ledger-menu");
  });

  it("applies the stamp treatment to shared badges and signal pills", () => {
    render(
      <div>
        <Badge>Active</Badge>
        <SignalPill tone="positive">Bullish</SignalPill>
        <TradeBranchBadge branch="congress" />
      </div>,
    );

    expect(screen.getByText("Active")).toHaveClass("ledger-stamp");
    expect(screen.getByText("Bullish")).toHaveClass("ledger-stamp", "text-profit");
    expect(screen.getByText("Cong")).toHaveClass("ledger-stamp");
  });

  it("applies report-style section rules to table headers", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>$AAPL</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByText("Ticker").closest("thead")).toHaveClass("ledger-section-line");
  });

  it("keeps trade badges in stamp-like buy and sell states", () => {
    render(
      <div>
        <TradeTypeBadge type="Buy" />
        <TradeTypeBadge type="Sell" />
      </div>,
    );

    expect(screen.getByText("Buy")).toHaveClass("ledger-stamp", "text-profit");
    expect(screen.getByText("Sell")).toHaveClass("ledger-stamp", "text-loss");
  });
});
