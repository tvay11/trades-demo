import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LongTermPlaySection, buildDriverOverlay } from "./LongTermPlaySection";
import type { LongTermPlay } from "@/lib/ledger/types";

const play: LongTermPlay = {
  schemaVersion: 1,
  horizon: "3-10 years",
  summary: "Gartner is a long-term bet on enterprise technology complexity, AI advisory demand, and resilient research subscriptions.",
  ifYouBelieve: "If you believe enterprises will keep increasing AI, cloud, cybersecurity, and software advisory spend, Gartner benefits from sitting in the IT decision layer.",
  whyItMatters: [
    "Recurring advisory relationships can compound if technology budgets remain complex.",
    "AI adoption creates demand for vendor selection and governance guidance.",
  ],
  themes: [
    {
      name: "Enterprise AI advisory",
      score: 0.78,
      direction: "tailwind",
      summary: "AI strategy work can expand Gartner's role in CIO decision-making.",
      evidence: ["AI procurement patent", "Enterprise budget stabilization"],
      risk: "Clients may automate some advisory workflows internally.",
    },
    {
      name: "IT budget cycle",
      score: 0.43,
      direction: "headwind",
      summary: "Discretionary budget softness can pressure advisory demand.",
      evidence: ["Budget commentary"],
      risk: "Renewal pressure would weaken the thesis.",
    },
  ],
  confirmingSignals: ["Renewal strength", "Margin durability"],
  breakingSignals: ["Weak IT budget commentary", "Client churn"],
  dataGaps: ["Segment-level AI advisory revenue was not available."],
  drivers: [],
};

describe("LongTermPlaySection", () => {
  it("renders the future exposure thesis, scored themes, and proof/disproof signals", () => {
    const { container } = render(<LongTermPlaySection play={play} />);

    expect(screen.getByRole("heading", { name: "Long-Term Play" })).toBeInTheDocument();
    expect(screen.getByText("business exposure · AI-classified · 3-10 year lens")).toBeInTheDocument();
    expect(screen.getByText("Enterprise AI advisory")).toBeInTheDocument();
    expect(screen.getByText("0.78")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "If you believe" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What confirms it" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What breaks it" })).toBeInTheDocument();
    expect(screen.getByText("Segment-level AI advisory revenue was not available.")).toBeInTheDocument();
    expect(container.querySelectorAll(".ltp-score-track")).toHaveLength(2);
  });

  it("renders nothing when no long-term play is available", () => {
    const { container } = render(<LongTermPlaySection play={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("buildDriverOverlay", () => {
  const expectClose = (got: number[], want: number[]) => {
    expect(got.length).toBe(want.length);
    got.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
  };

  it("aligns on shared dates and indexes both series to 100", () => {
    const driver = [
      { date: "2025-01-01", close: 200 },
      { date: "2025-01-02", close: 210 },
      { date: "2025-01-03", close: 220 },
    ];
    const stock = new Map([["2025-01-01", 100], ["2025-01-02", 110], ["2025-01-03", 121]]);
    const out = buildDriverOverlay(driver, stock)!;
    expectClose(out.driverIdx, [100, 105, 110]);
    expectClose(out.stockIdx, [100, 110, 121]);
  });

  it("skips driver dates the stock has no bar for and re-bases on the first shared date", () => {
    const driver = [
      { date: "2025-01-01", close: 200 },
      { date: "2025-01-02", close: 210 }, // no stock bar this day → dropped
      { date: "2025-01-03", close: 220 },
      { date: "2025-01-06", close: 230 },
    ];
    const stock = new Map([["2025-01-01", 100], ["2025-01-03", 121], ["2025-01-06", 132]]);
    const out = buildDriverOverlay(driver, stock)!;
    expectClose(out.driverIdx, [100, 110, 115]); // closes [200,220,230] / 200
    expectClose(out.stockIdx, [100, 121, 132]);
  });

  it("returns null with fewer than 2 shared dates", () => {
    const driver = [{ date: "2025-01-01", close: 200 }, { date: "2025-01-02", close: 210 }];
    const stock = new Map([["2025-01-01", 100]]);
    expect(buildDriverOverlay(driver, stock)).toBeNull();
  });

  it("returns null when the driver base close is zero", () => {
    const driver = [{ date: "2025-01-01", close: 0 }, { date: "2025-01-02", close: 210 }];
    const stock = new Map([["2025-01-01", 100], ["2025-01-02", 110]]);
    expect(buildDriverOverlay(driver, stock)).toBeNull();
  });

  it("returns null when the stock base close is zero", () => {
    const driver = [{ date: "2025-01-01", close: 200 }, { date: "2025-01-02", close: 210 }];
    const stock = new Map([["2025-01-01", 0], ["2025-01-02", 110]]);
    expect(buildDriverOverlay(driver, stock)).toBeNull();
  });
});
