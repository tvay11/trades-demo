import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MorningNoteSection } from "./MorningNoteSection";
import type { MorningNoteResult } from "@/lib/brief/generateMorningNote";

// Mock the client component to avoid useRouter / useTransition in jsdom
vi.mock("./RegenerateNoteButton", () => ({
  RegenerateNoteButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Regenerate"}</button>
  ),
}));

const validResult: MorningNoteResult = {
  note: {
    schemaVersion: 1,
    headline: "Risk-on rally continues as tech leads gains across the board",
    note: "Overnight futures rallied on softer-than-expected inflation data, with the S&P 500 gapping up at the open. Tech is the standout sector, led by semiconductor strength after a string of earnings beats. The yield curve steepened modestly. The dollar softened, providing a tailwind for multinational earners. Macro backdrop is risk-on but sentiment indicators are stretched — watch for consolidation.",
    watchItems: [
      "NVDA earnings call — listen for data-center demand commentary",
      "10-year yield above 4.5% — would pressure growth multiples",
      "Dollar index DXY — a break above 106 signals risk-off",
    ],
    headlineTags: [
      { title: "Fed holds rates steady", url: "https://example.com/1", sentiment: "neutral" },
      { title: "Nvidia crushes Q1 estimates", url: "https://example.com/2", sentiment: "bullish" },
      { title: "China widens tariffs on semiconductors", url: null, sentiment: "bearish" },
    ],
  },
  generatedAt: "2026-06-12T08:30:00.000Z",
  fresh: true,
};

describe("MorningNoteSection", () => {
  it("renders headline and watch items", () => {
    render(<MorningNoteSection result={validResult} />);

    expect(screen.getByText("Risk-on rally continues as tech leads gains across the board")).toBeInTheDocument();

    // All three watch items
    expect(screen.getByText(/NVDA earnings call/)).toBeInTheDocument();
    expect(screen.getByText(/10-year yield above 4\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/Dollar index DXY/)).toBeInTheDocument();

    // Headline tags
    expect(screen.getByText("Fed holds rates steady")).toBeInTheDocument();
    expect(screen.getByText("Nvidia crushes Q1 estimates")).toBeInTheDocument();
    expect(screen.getByText("China widens tariffs on semiconductors")).toBeInTheDocument();

    // Regenerate button
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
  });

  it("renders empty state with Generate button when result is null", () => {
    render(<MorningNoteSection result={null} />);

    expect(screen.getByText(/no morning note yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
  });
});
