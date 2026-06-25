import "./report.css";

import Link from "next/link";

import { periodToEarningsBreakdown } from "@/lib/queries/edgarFundamentals";
import { ReportThemeButton } from "./ReportThemeButton";
import { ReportWatchButton } from "./ReportWatchButton";
import { ReportToc } from "./ReportToc";
import { AnalystConsensusSection } from "./AnalystConsensusSection";
import { StreetMomentumSection } from "./StreetMomentumSection";
import { EarningsWaterfallSection } from "./EarningsWaterfallSection";
import { TradesSection } from "./TradesSection";
import { LedgerMacdChart } from "@/components/charts/ledger/LedgerMacdChart";
import { LedgerRsiChart } from "@/components/charts/ledger/LedgerRsiChart";
import { LedgerTechnicalChart } from "@/components/charts/ledger/LedgerTechnicalChart";
import { LedgerVolumeChart } from "@/components/charts/ledger/LedgerVolumeChart";
import { getReport } from "@/lib/ledger/getReport";
import { isTickerWatched } from "@/lib/queries/watchlist";
import { normalizeNewsScore } from "@/lib/ledger/newsScore";
import type { Ledger, NewsItem } from "@/lib/ledger/types";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} report` };
}

const usd = (n: number | null) =>
  n == null ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const TOC_SECTIONS = [
  { id: "forward-look", label: "Overview" },
  { id: "technicals", label: "Technicals" },
  { id: "earnings", label: "Earnings" },
  { id: "news", label: "News Cycle" },
  { id: "flows", label: "Flows & Trades" },
];

export default async function ReportPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const report = await getReport(ticker);

  if (!report) {
    return (
      <div className="kl kl-theme-dark">
        <div className="page">
          <div className="util">
            <ReportThemeButton />
          </div>
          <div className="masthead">
            <div className="title">{ticker.toUpperCase()} report</div>
          </div>
          <div className="sec" style={{ padding: "48px 36px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-heading)", fontSize: "24px", marginBottom: "12px" }}>
              No report yet for {ticker.toUpperCase()}
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--muted-foreground)" }}>
              Data for this ticker is not loaded in the demo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const watched = await isTickerWatched(ticker);

  return (
    <div className="kl kl-theme-dark">
      <ReportToc sections={TOC_SECTIONS} />
      <Tearsheet report={report} watched={watched} />
    </div>
  );
}

function NewsScoreBadge({ item }: { item: NewsItem }) {
  const normalized = normalizeNewsScore(item.score);
  const scoreText = normalized.toFixed(2);
  return (
    <span className={`news-score news-score-${item.sentiment}`}>
      <span>{item.sentiment.toUpperCase()}</span>
      <span>{scoreText}</span>
    </span>
  );
}

function NewsCycleItem({ item }: { item: NewsItem }) {
  const isBullish = item.sentiment === "bullish";
  return (
    <div className="ni">
      <span className={`s ${isBullish ? "pos" : "neg"}`}>{isBullish ? "+" : "−"}</span>
      <span>
        <span className="news-head">
          <b>{item.title}</b>
          <NewsScoreBadge item={item} />
        </span>
        {item.summary ? <> {item.summary}</> : null}
        {item.url && (
          <a className="src" href={item.url} target="_blank" rel="noreferrer">
            {item.publisher ?? "source"} ↗
          </a>
        )}
        {item.publishedAt ? <span className="mono" style={{ fontSize: "10px", color: "var(--muted-foreground)", marginLeft: "4px" }}>· {shortDate(item.publishedAt)}</span> : null}
      </span>
    </div>
  );
}

function Tearsheet({ report, watched }: { report: Ledger; watched: boolean }) {
  const ticker = report.ticker.toUpperCase();
  const companyName = report.companyName ?? "";
  const dateStr = report.generatedAt.slice(0, 10);
  const needleLeft = `${(((report.newsSkew ?? 0) + 1) / 2) * 100}%`;

  return (
    <div className="page">
      {/* Disclaimer Banner */}
      <div style={{
        padding: "12px 36px",
        background: "color-mix(in srgb, var(--warn) 10%, transparent)",
        borderBottom: "1px solid var(--border)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        color: "var(--warn)",
        lineHeight: "1.5"
      }}>
        ⚠️ <b>MOCK DATA &amp; DISCLAIMER:</b> This report contains fictional mock data generated for preview purposes only. It is not financial advice. None of the listed transactions, charts, target values, or details represent actual events or real-world holdings.
      </div>

      {/* UTILITY BAR */}
      <div className="util">
        <span style={{ display: "inline-flex", alignItems: "center", gap: "14px" }}>
          <span>Generated {dateStr}</span>
          <ReportThemeButton />
          <ReportWatchButton ticker={ticker} watched={watched} />
        </span>
      </div>

      {/* FORWARD LOOK HERO */}
      <div id="forward-look" className="fwd-hero">
        <div className="fwd-masthead">
          <span className="fwd-tk">{ticker} · <b>{companyName}</b></span>
        </div>
        <div className="fwd-caption">
          <span className="fwd-prices">
            <span>Last Close</span>{" "}{usd(report.lastClose)}
          </span>
          <div className="horizon">
            {report.consensusTarget != null
              ? `Analyst consensus target ${usd(report.consensusTarget)}`
              : "Factual trade flow and market data preview"}
          </div>
        </div>
      </div>

      {/* NEXT-EARNINGS FLAG */}
      {report.nextEarnings && report.nextEarnings.daysUntil != null && (
        <div
          style={{
            padding: "8px 36px",
            borderBottom: "1px solid var(--border)",
            background: "var(--accent)",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ color: "var(--muted-foreground)" }}>
            &#9873; Next earnings in {report.nextEarnings.daysUntil} days
            {report.nextEarnings.date ? ` (≈${report.nextEarnings.date})` : ""}
            {report.nextEarnings.isEstimate ? " (est.)" : ""}
          </span>
        </div>
      )}

      {/* I. TECHNICAL CHART */}
      <div id="technicals" className="sec">
        <div className="secline">
          <h3>I. The Technical Picture</h3>
          <span className="meta">90 sessions · daily</span>
        </div>
        <div className="leg">
          <b><span className="sw" style={{ background: "var(--foreground)" }} />Close</b>
          <b><span className="sw" style={{ background: "color-mix(in srgb,var(--bear) 14%,transparent)" }} />Bollinger 20,2</b>
          <b><span className="sw" style={{ background: "var(--warn)" }} />SMA 50</b>
          <b><span className="sw" style={{ background: "var(--info)" }} />SMA 200</b>
        </div>
        <div className="chart-box">
          <LedgerTechnicalChart bars={report.bars} />
        </div>
        <div className="leg">Volume — daily · 20-day average</div>
        <div className="chart-box sm">
          <LedgerVolumeChart bars={report.bars} />
        </div>
        <div className="twocol">
          <div>
            <div className="leg">RSI (14)</div>
            <div className="chart-box sm">
              <LedgerRsiChart bars={report.bars} />
            </div>
          </div>
          <div>
            <div className="leg">MACD (12,26,9)</div>
            <div className="chart-box sm">
              <LedgerMacdChart bars={report.bars} />
            </div>
          </div>
        </div>
      </div>

      {/* II. EARNINGS SNAPSHOT */}
      <div id="earnings" className="sec">
        <div className="secline">
          <h3>II. The Earnings Snapshot</h3>
          <span className="meta">straight from the filings</span>
        </div>
        <EarningsWaterfallSection
          heading="Income Statement · Full Year"
          breakdown={report.fundamentals?.earnings ?? periodToEarningsBreakdown(report.fundamentals?.annual ?? null) ?? undefined}
        />
        {report.fundamentals?.quarterlyEarnings && (
          <div style={{ marginTop: "8px" }}>
            <EarningsWaterfallSection heading="Income Statement · Latest Quarter" breakdown={report.fundamentals.quarterlyEarnings} />
          </div>
        )}
      </div>

      {/* III. NEWS CYCLE */}
      <div id="news" className="sec">
        <div className="secline">
          <h3>III. The News Cycle</h3>
          <span className="meta">public news sentiment breakdown</span>
        </div>
        {report.news.length === 0 ? (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--muted-foreground)", fontStyle: "italic" }}>
            No news available.
          </p>
        ) : (
          <>
            <div className="meter">
              <div className="seg m1">NEAR-TERM CAUTIOUS</div>
              <div className="seg m2">MIXED</div>
              <div className="seg m3">STRUCTURALLY BULLISH</div>
              <div className="mneedle" style={{ left: needleLeft }} />
            </div>
            <div className="news-cols">
              <div>
                <div className="nh red">Bearish Sentiment</div>
                {report.news
                  .filter((n) => n.sentiment === "bearish")
                  .sort((a, b) => normalizeNewsScore(b.score) - normalizeNewsScore(a.score))
                  .map((n, i) => (
                    <NewsCycleItem key={i} item={n} />
                  ))}
              </div>
              <div>
                <div className="nh green">Bullish Sentiment</div>
                {report.news
                  .filter((n) => n.sentiment === "bullish")
                  .sort((a, b) => normalizeNewsScore(b.score) - normalizeNewsScore(a.score))
                  .map((n, i) => (
                    <NewsCycleItem key={i} item={n} />
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* III-b. ANALYST CONSENSUS */}
      <AnalystConsensusSection analyst={report.analyst} />

      {/* III-c. STREET MOMENTUM */}
      {report.streetMomentum && <StreetMomentumSection sm={report.streetMomentum} />}

      {/* IV. INSIDER & POLITICAL ACTIVITY */}
      <div id="flows">
        <TradesSection official={report.officialTrades} insider={report.insiderTrades} />
      </div>

      {/* COLOPHON */}
      <div className="colophon">
        Fictional Mock Data · Not Financial Advice · Generated {report.generatedAt}
      </div>
    </div>
  );
}
