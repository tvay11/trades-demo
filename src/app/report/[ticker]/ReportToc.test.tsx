import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportToc } from "./ReportToc";

const sections = [
  { id: "forward-look", label: "Forward Look" },
  { id: "news", label: "News Cycle" },
];

describe("ReportToc", () => {
  it("renders one anchor link per section", () => {
    render(<ReportToc sections={sections} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "#forward-look");
    expect(links[1]).toHaveAttribute("href", "#news");
    expect(screen.getByText("News Cycle")).toBeInTheDocument();
  });

  it("renders a nav landmark labelled Report sections", () => {
    render(<ReportToc sections={sections} />);
    expect(screen.getByRole("navigation", { name: "Report sections" })).toBeInTheDocument();
  });

  it("marks no link as current before any section is observed", () => {
    render(<ReportToc sections={sections} />);
    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});
