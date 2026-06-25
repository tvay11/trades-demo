import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalMiniStrips } from "./SignalMiniStrips";
import type { Ledger } from "@/lib/ledger/types";

const report = {
  ticker: "NVDA",
  streetMomentum: { read: "improving", revisions: [{ period: "0q", up30: 3, down30: 1 }], trendDeltas: [], surprises: [], beatCount: 6, surpriseTotal: 8, avgSurprisePct: 4, upgrades30: 2, downgrades30: 0, recentActions: [], pead: { active: false, daysSinceReport: null, lastSurprisePct: null, direction: null } },
  options: { lean: "bullish", putCallVolume: 0.7, putCallOI: 0.8, atmIvPct: 38, ivSkewPct: 1.2, expectedMovePct: 5, expiration: "2026-07-17", daysToExp: 36, asOf: "2026-06-10", ivRankPct: 22 },
  altFlow: { wsb: { mentions7d: 412, mentionsPrior7d: 100, surgeRatio: 4.1, latestSentiment: 0.2, crowded: true }, darkShort: null, thirteenF: null, govContracts: null },
} as unknown as Ledger;

describe("SignalMiniStrips", () => {
  it("renders street momentum, options, and alt-flow lines", () => {
    render(<SignalMiniStrips report={report} />);
    expect(screen.getByText(/IMPROVING/)).toBeInTheDocument();
    expect(screen.getByText(/▲3/)).toBeInTheDocument();
    expect(screen.getByText(/IV rank 22%/)).toBeInTheDocument();
    expect(screen.getByText(/412 WSB/)).toBeInTheDocument();
    expect(screen.getByText("CROWDED")).toBeInTheDocument();
  });
  it("hides strips whose data is absent and renders nothing when all absent", () => {
    const { container } = render(<SignalMiniStrips report={{ ticker: "X" } as unknown as Ledger} />);
    expect(container.firstChild).toBeNull();
  });
});
