import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalystAnalysis, Ledger, LongTermPlay } from "@/lib/ledger/types";

const askReportBoxMock = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/lib/ledger/getReport", () => ({
  getReport: vi.fn(),
}));

vi.mock("@/components/charts/ledger/LedgerForecastChart", () => ({
  LedgerForecastChart: () => <div data-testid="forecast-chart" />,
}));

vi.mock("@/components/charts/ledger/LedgerMacdChart", () => ({
  LedgerMacdChart: () => <div data-testid="macd-chart" />,
}));

vi.mock("@/components/charts/ledger/LedgerVolumeChart", () => ({
  LedgerVolumeChart: () => <div data-testid="volume-chart" />,
}));

vi.mock("@/components/charts/ledger/LedgerRsiChart", () => ({
  LedgerRsiChart: () => <div data-testid="rsi-chart" />,
}));

vi.mock("@/components/charts/ledger/LedgerTechnicalChart", () => ({
  LedgerTechnicalChart: () => <div data-testid="technical-chart" />,
}));

vi.mock("./RemakeReportButton", () => ({
  RemakeReportButton: () => <button type="button">Remake report</button>,
}));

vi.mock("./RefreshForecastButton", () => ({
  RefreshForecastButton: () => <button type="button">Refresh forecast</button>,
}));

vi.mock("./AskReportBox", () => ({ AskReportBox: askReportBoxMock }));

vi.mock("./ReportWatchButton", () => ({
  ReportWatchButton: ({ watched }: { watched: boolean }) => (
    <button type="button">{watched ? "Watching" : "Watch"}</button>
  ),
}));

vi.mock("@/lib/queries/watchlist", () => ({
  isTickerWatched: vi.fn().mockResolvedValue(false),
}));

import ReportPage from "./page";
import { getReport } from "@/lib/ledger/getReport";

const report: Ledger = {
  ticker: "GOOGL",
  companyName: "Alphabet Inc.",
  generatedAt: "2026-06-02T12:00:00.000Z",
  lastClose: 175.25,
  scorecard: [],
  trendGrid: [],
  houseCall: {
    rating: "HOLD",
    drivers: ["Mixed setup"],
    watchTrigger: "Watch the next close",
    synthesis: "The setup is mixed.",
    score: 0,
    contributions: [{ label: "Trend (50>200)", value: 1 }, { label: "Forecast", value: -1 }],
  },
  forecast: null,
  fundamentals: null,
  signals: null,
  news: [],
  newsSkew: 0,
  consensusTarget: null,
  bars: [{ date: "2026-06-01", open: 174, high: 176, low: 173, close: 175.25, volume: 1000 }],
  forecastPoints: [],
  analystNote: null,
  analystAnalysis: null,
  geopolitical: null,
  fundamentalsInsight: null,
  longTermPlay: null,
  officialTrades: [],
  insiderTrades: [],
  macro: null,
  options: null,
  valuation: null,
  analyst: null,
  shortInterest: null,
  nextEarnings: null,
  tradeLens: null,
  forecastTrackRecord: null,
  streetMomentum: null,
  altFlow: null,
  riskShift: null,
  forensics: null,
  segments: null,
};

const validAnalysis: AnalystAnalysis = {
  schemaVersion: 1,
  verdict: { action: "BUY", conviction: "high", bottomLine: "This is a high-conviction BUY on momentum, margins, and clean cash conversion." },
  headline: "Momentum supports the rating, but risk remains visible",
  thesis: "The BUY call is supported by momentum and fundamentals, with news risk keeping conviction measured.",
  lensReads: [
    { lens: "technicals", posture: "bullish", summary: "Momentum supports the call.", evidence: ["Momentum (MACD) BULL"] },
    { lens: "fundamentals", posture: "unavailable", summary: "No fundamentals were available.", evidence: [] },
    { lens: "flows", posture: "neutral", summary: "Flow is not decisive.", evidence: ["congressNetFlowLabel Balanced"] },
    { lens: "news", posture: "mixed", summary: "News is mixed.", evidence: ["newsSkew 0.5"] },
  ],
  takeaways: [
    { kind: "support", label: "Support", text: "Momentum and fundamentals help." },
    { kind: "risk", label: "Risk", text: "News risk remains." },
    { kind: "watch", label: "Watch", text: "Watch momentum deterioration." },
  ],
  keyTension: "Positive direction with visible uncertainty.",
  whatWouldChange: "A breakdown in momentum would weaken the view.",
};

const longTermPlay: LongTermPlay = {
  schemaVersion: 1,
  horizon: "3-10 years",
  summary: "Alphabet is a long-term bet on AI infrastructure, cloud workloads, and durable search distribution.",
  ifYouBelieve: "If you believe AI workloads keep shifting to large-scale cloud platforms, Alphabet benefits through compute, models, and enterprise distribution.",
  whyItMatters: [
    "Cloud scale can compound as AI workloads move into production.",
    "Search and YouTube provide cash flow for long-duration AI investment.",
  ],
  themes: [
    {
      name: "AI infrastructure",
      score: 0.84,
      direction: "tailwind",
      summary: "AI compute demand supports cloud and internal model investment.",
      evidence: ["Cloud demand improves"],
      risk: "Capex intensity could pressure free cash flow.",
    },
  ],
  confirmingSignals: ["Cloud backlog growth", "AI product monetization"],
  breakingSignals: ["Search share erosion", "Capex without revenue conversion"],
  dataGaps: [],
  drivers: [
    { label: "Semiconductors", symbol: "SOXX", why: "Compute demand proxy", corr: 0.62,
      points: [
        { date: "2025-01-01", close: 200 }, { date: "2025-02-01", close: 210 }, { date: "2025-03-01", close: 225 },
      ] },
  ],
};

describe("ReportPage", () => {
  beforeEach(() => {
    askReportBoxMock.mockClear();
  });

  it("omits the newspaper masthead labels from generated reports", async () => {
    vi.mocked(getReport).mockResolvedValue(report);

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByText("Last Close")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.queryByText("Forward Edition")).not.toBeInTheDocument();
    expect(screen.queryByText("Research only")).not.toBeInTheDocument();
    expect(screen.queryByText("Alphabet Inc. · GOOGL")).not.toBeInTheDocument();
    expect(screen.queryByText("Forward TA Tearsheet")).not.toBeInTheDocument();
    expect(screen.getByText("Volume — daily · 20-day average")).toBeInTheDocument();
  });

  it("renders structured analyst analysis when analystAnalysis is set", async () => {
    vi.mocked(getReport).mockResolvedValue({ ...report, analystAnalysis: validAnalysis });

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByText("Momentum supports the rating, but risk remains visible")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key tension" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What would change" })).toBeInTheDocument();
    expect(screen.getByText("high conviction")).toBeInTheDocument();
    expect(screen.getByText("This is a high-conviction BUY on momentum, margins, and clean cash conversion.")).toBeInTheDocument();
  });

  it("renders legacy analyst note when only analystNote is set", async () => {
    vi.mocked(getReport).mockResolvedValue({ ...report, analystNote: "This is the legacy note paragraph.", analystAnalysis: null });

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByText("This is the legacy note paragraph.")).toBeInTheDocument();
  });

  it("renders The Synthesis as a rating-toned callout", async () => {
    vi.mocked(getReport).mockResolvedValue(report);

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    const synthesis = screen.getByRole("heading", { name: "The Synthesis" }).closest(".report-callout");

    expect(synthesis).toHaveClass("report-callout-mixed", "synthesis-callout");
    expect(synthesis).toHaveTextContent("Net score");
    expect(synthesis).toHaveTextContent("Watch the next close");
  });

  it("does not render Ask the Report on report pages", async () => {
    vi.mocked(getReport).mockResolvedValue(report);

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(askReportBoxMock).not.toHaveBeenCalled();
  });

  it("renders the long-term play section when present in the report snapshot", async () => {
    vi.mocked(getReport).mockResolvedValue({
      ...report,
      longTermPlay,
      bars: [
        { date: "2025-01-01", open: 0, high: 0, low: 0, close: 100, volume: 0 },
        { date: "2025-02-01", open: 0, high: 0, low: 0, close: 110, volume: 0 },
        { date: "2025-03-01", open: 0, high: 0, low: 0, close: 120, volume: 0 },
      ],
    });

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByRole("heading", { name: "Long-Term Play" })).toBeInTheDocument();
    expect(screen.getByText("AI infrastructure")).toBeInTheDocument();
    expect(screen.getByText("0.84")).toBeInTheDocument();
    expect(screen.getByText(/If you believe AI workloads/)).toBeInTheDocument();
    expect(screen.getByText("Industry drivers · indexed to 100 · ~1y")).toBeInTheDocument();
    expect(screen.getByText("Semiconductors")).toBeInTheDocument();
    expect(screen.getByText("moves with the stock")).toBeInTheDocument();
    expect(screen.getByText(/r \+0\.62/)).toBeInTheDocument();
    expect(screen.getByText("STOCK")).toBeInTheDocument();
    expect(screen.getByText("SOXX")).toBeInTheDocument();
  });

  it("falls back to the driver-only chart when stock bars do not overlap", async () => {
    vi.mocked(getReport).mockResolvedValue({
      ...report,
      longTermPlay,
      bars: [{ date: "2099-01-01", open: 0, high: 0, low: 0, close: 100, volume: 0 }],
    });

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByText("Semiconductors")).toBeInTheDocument();
    expect(screen.queryByText("STOCK")).not.toBeInTheDocument();
  });

  it("renders geopolitical impact as a numeric score instead of magnitude text", async () => {
    vi.mocked(getReport).mockResolvedValue({
      ...report,
      geopolitical: {
        summary: "Policy pressure remains the dominant external risk.",
        netLean: "headwind",
        factors: [
          {
            event: "US export controls",
            impact: "negative",
            score: 0.72,
            rationale: "Limits overseas data-center demand.",
            url: "https://example.com/export-controls",
            publisher: "Example",
          },
        ],
      },
    });

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByText("0.72")).toBeInTheDocument();
    expect(screen.queryByText("[negative · medium]")).not.toBeInTheDocument();
    expect(screen.queryByText(/magnitude/i)).not.toBeInTheDocument();
  });

  it("renders news cycle items with numeric score badges and meters", async () => {
    vi.mocked(getReport).mockResolvedValue({
      ...report,
      news: [
        {
          title: "Regulatory risk rises",
          publisher: "Example",
          url: "https://example.com/regulatory-risk",
          publishedAt: null,
          summary: "New scrutiny could pressure margins.",
          sentiment: "bearish",
          score: 0.68,
        },
        {
          title: "Cloud demand improves",
          publisher: "Example",
          url: "https://example.com/cloud-demand",
          publishedAt: null,
          summary: "Enterprise demand supports revenue.",
          sentiment: "bullish",
          score: 0.41,
        },
      ],
    });

    const { container } = render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByText("0.68")).toBeInTheDocument();
    expect(screen.getByText("0.41")).toBeInTheDocument();
    expect(container.querySelectorAll(".news-score-track")).toHaveLength(2);
  });

  it("renders the income-statement waterfall when earnings breakdown is present", async () => {
    vi.mocked(getReport).mockResolvedValue({
      ...report,
      fundamentals: {
        annual: null, quarter: null,
        earnings: {
          fiscalLabel: "FY2025", periodEnd: "2025-12-31", form: "10-K",
          lines: [
            { key: "revenue", label: "Revenue", value: 1200, marginPct: null, yoyPct: 20, kind: "total" },
            { key: "grossProfit", label: "Gross profit", value: 720, marginPct: 60, yoyPct: null, kind: "subtotal" },
            { key: "operatingIncome", label: "Operating income", value: 490, marginPct: 40.8, yoyPct: 19, kind: "subtotal" },
            { key: "netIncome", label: "Net income", value: 360, marginPct: 30, yoyPct: 20, kind: "subtotal" },
          ],
          trend: [
            { fiscalLabel: "FY2024", revenue: 1000, operatingMarginPct: 41, netMarginPct: 30, fcfMarginPct: 30 },
            { fiscalLabel: "FY2025", revenue: 1200, operatingMarginPct: 40.8, netMarginPct: 30, fcfMarginPct: 30 },
          ],
        },
      },
    });
    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));
    expect(screen.getByText(/Income Statement/)).toBeInTheDocument();
    expect(screen.getByText("Operating income")).toBeInTheDocument();
  });

  it("does not render the forensics section when forensics is null", async () => {
    vi.mocked(getReport).mockResolvedValue(report); // base fixture has forensics: null
    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));
    expect(screen.queryByText(/Quality of Earnings/)).not.toBeInTheDocument();
  });

  it("renders the quality-of-earnings forensics section when present", async () => {
    vi.mocked(getReport).mockResolvedValue({
      ...report,
      forensics: {
        overall: "concerning",
        yearsAnalyzed: 2,
        patterns: [
          { key: "fcf_vs_ni", label: "FCF vs net income", verdict: "concerning", metric: "FCF/NI 0.57 over 2y", detail: "Free cash flow is lagging reported net income." },
        ],
      },
    });

    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));

    expect(screen.getByText(/Quality of Earnings/)).toBeInTheDocument();
    expect(screen.getByText("FCF vs net income")).toBeInTheDocument();
  });

  it("renders the segment breakdown when segments are present", async () => {
    vi.mocked(getReport).mockResolvedValue({
      ...report,
      segments: {
        fiscalLabel: "FY2025", reconciledPct: 97, note: "Data Center dominates.",
        segments: [
          { name: "Data Center", revenue: 115200, sharePct: 91, yoyPct: 142 },
          { name: "Gaming", revenue: 11400, sharePct: 9, yoyPct: 14 },
        ],
      },
    });
    render(await ReportPage({ params: Promise.resolve({ ticker: "googl" }) }));
    expect(screen.getByText(/Revenue by Segment/)).toBeInTheDocument();
    expect(screen.getByText("Data Center")).toBeInTheDocument();
  });
});
