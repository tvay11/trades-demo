import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataRow, HeroBand, HeroCell, Stamp, StatTile } from "./primitives";

describe("DataRow", () => {
  it("renders label, value, and note", () => {
    render(<DataRow label="Put / Call volume ratio" value="0.84" note="balanced" />);
    expect(screen.getByText("Put / Call volume ratio")).toBeInTheDocument();
    expect(screen.getByText("0.84")).toBeInTheDocument();
    expect(screen.getByText("balanced")).toBeInTheDocument();
  });

  it("renders without a note", () => {
    const { container } = render(<DataRow label="Shares short" value="12.3M" />);
    expect(screen.getByText("Shares short")).toBeInTheDocument();
    expect(container.querySelectorAll(".drow > span")).toHaveLength(3);
  });

  it("applies the sm variant class", () => {
    const { container } = render(<DataRow size="sm" label="Vanguard Group" value="$1.2M" />);
    expect(container.querySelector(".drow-sm")).not.toBeNull();
  });
});

describe("Stamp", () => {
  it("applies the tone class and renders children", () => {
    const { container } = render(<Stamp tone="bear">CROWDED</Stamp>);
    expect(container.querySelector(".stamp-bear")).not.toBeNull();
    expect(screen.getByText("CROWDED")).toBeInTheDocument();
  });

  it("defaults to neutral (no tone class)", () => {
    const { container } = render(<Stamp>FLAT</Stamp>);
    expect(container.querySelector(".stamp")).not.toBeNull();
    expect(container.querySelector(".stamp-bull")).toBeNull();
    expect(container.querySelector(".stamp-bear")).toBeNull();
  });

  it("forwards a title attribute", () => {
    render(<Stamp tone="warn" title="hover text">MODERATE</Stamp>);
    expect(screen.getByTitle("hover text")).toBeInTheDocument();
  });

  it("applies stamp-inline when inline prop is set", () => {
    const { container } = render(<Stamp tone="warn" inline>X</Stamp>);
    expect(container.querySelector(".stamp-inline")).not.toBeNull();
  });
});

describe("HeroBand / HeroCell", () => {
  it("renders label and value content", () => {
    render(
      <HeroBand>
        <HeroCell label="Street Read">IMPROVING</HeroCell>
        <HeroCell label="Beat Rate">6/8</HeroCell>
      </HeroBand>,
    );
    expect(screen.getByText("Street Read")).toBeInTheDocument();
    expect(screen.getByText("IMPROVING")).toBeInTheDocument();
    expect(screen.getByText("6/8")).toBeInTheDocument();
  });

  it("applies the left alignment class", () => {
    const { container } = render(
      <HeroBand>
        <HeroCell align="left" label="Range">low — high</HeroCell>
      </HeroBand>,
    );
    expect(container.querySelector(".hero-cell-left")).not.toBeNull();
  });
});

describe("StatTile", () => {
  it("renders label, note, and children", () => {
    render(
      <StatTile label="WSB Heat" note="surge ×3.1">
        <div>412 mentions</div>
      </StatTile>,
    );
    expect(screen.getByText("WSB Heat")).toBeInTheDocument();
    expect(screen.getByText("surge ×3.1")).toBeInTheDocument();
    expect(screen.getByText("412 mentions")).toBeInTheDocument();
  });
});
