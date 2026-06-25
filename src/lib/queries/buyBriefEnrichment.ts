import { applyCacheLife } from "@/lib/cache";
import { db } from "@/lib/db";

// Per-ticker enrichment that layers the remaining populated datasets on top of
// the core long-short / dark-flow / dual-insider signals. Everything here is
// scoped to an allowlist of signal tickers (passed in by the caller) so we only
// aggregate rows for candidates that already made the brief — never the whole
// 7k-ticker universe.

export interface BuyBriefEnrichmentRow {
  ticker: string;
  // Price (TickerPriceCache)
  lastClose: number | null;
  lastCloseDate: Date | null;
  return30dPct: number | null;
  return90dPct: number | null;
  // Institutions (ThirteenFHolding)
  instHolders: number | null;
  instTotalShares: number | null;
  instShareChange: number | null;
  instReportDate: Date | null;
  // Catalysts ($ flows, trailing 1y)
  govContractUsd1y: number | null;
  govContractCount1y: number | null;
  lobbyingUsd1y: number | null;
  patentGrants1y: number | null;
  // Attention & risk
  wsbMentions30d: number | null;
  wsbSentiment30d: number | null;
  politicalBeta: number | null;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function getBuyBriefEnrichment(
  tickers: string[],
): Promise<{ rows: BuyBriefEnrichmentRow[]; source: "database" | "database-error" }> {
  "use cache";
  applyCacheLife("minutes");

  const unique = [...new Set(tickers)].filter(Boolean);
  if (unique.length === 0) return { rows: [], source: "database" };

  const since1y = daysAgo(365);
  const since30 = daysAgo(30);
  const inTickers = { ticker: { in: unique } };

  try {
    const [prices, holdings, contracts, lobbying, patents, wsb, beta] =
      await Promise.all([
        db.tickerPriceCache.findMany({
          where: inTickers,
          select: { ticker: true, date: true, close: true },
          orderBy: { date: "asc" },
        }),
        db.thirteenFHolding.findMany({
          where: inTickers,
          select: { ticker: true, filer: true, shares: true, changeShares: true, reportDate: true },
        }),
        db.govContract.findMany({
          where: { ...inTickers, awardedAt: { gte: since1y } },
          select: { ticker: true, amountCents: true },
        }),
        db.lobbyingDisclosure.findMany({
          where: { ...inTickers, filedAt: { gte: since1y } },
          select: { ticker: true, amountCents: true },
        }),
        db.patent.findMany({
          where: { ...inTickers, grantedAt: { gte: since1y } },
          select: { ticker: true },
        }),
        db.wsbMention.findMany({
          where: { ...inTickers, date: { gte: since30 } },
          select: { ticker: true, mentions: true, sentiment: true },
        }),
        db.politicalBeta.findMany({
          where: inTickers,
          select: { ticker: true, beta: true, asOfDate: true },
        }),
      ]);

    const byTicker = new Map<string, BuyBriefEnrichmentRow>();
    const ensure = (ticker: string): BuyBriefEnrichmentRow => {
      const existing = byTicker.get(ticker);
      if (existing) return existing;
      const created: BuyBriefEnrichmentRow = {
        ticker,
        lastClose: null,
        lastCloseDate: null,
        return30dPct: null,
        return90dPct: null,
        instHolders: null,
        instTotalShares: null,
        instShareChange: null,
        instReportDate: null,
        govContractUsd1y: null,
        govContractCount1y: null,
        lobbyingUsd1y: null,
        patentGrants1y: null,
        wsbMentions30d: null,
        wsbSentiment30d: null,
        politicalBeta: null,
      };
      byTicker.set(ticker, created);
      return created;
    };

    // ── Prices: latest close + trailing returns ─────────────────────────
    // Rows arrive sorted by date asc, so we can scan once per ticker.
    const seriesByTicker = new Map<string, Array<{ date: Date; close: number }>>();
    for (const p of prices) {
      const arr = seriesByTicker.get(p.ticker) ?? [];
      arr.push({ date: p.date, close: Number(p.close) });
      seriesByTicker.set(p.ticker, arr);
    }
    for (const [ticker, series] of seriesByTicker) {
      if (series.length === 0) continue;
      const latest = series[series.length - 1];
      const row = ensure(ticker);
      row.lastClose = latest.close;
      row.lastCloseDate = latest.date;
      const priorClose = (lookbackDays: number): number | null => {
        const cutoff = latest.date.getTime() - lookbackDays * 86_400_000;
        // Last row at or before the cutoff (series is asc).
        let chosen: number | null = null;
        for (const point of series) {
          if (point.date.getTime() <= cutoff) chosen = point.close;
          else break;
        }
        return chosen;
      };
      const p30 = priorClose(30);
      const p90 = priorClose(90);
      if (p30 && p30 !== 0) row.return30dPct = round2(((latest.close - p30) / p30) * 100);
      if (p90 && p90 !== 0) row.return90dPct = round2(((latest.close - p90) / p90) * 100);
    }

    // ── 13F institutional holdings ──────────────────────────────────────
    const filersByTicker = new Map<string, Set<string>>();
    for (const h of holdings) {
      const row = ensure(h.ticker);
      const filers = filersByTicker.get(h.ticker) ?? new Set<string>();
      filers.add(h.filer);
      filersByTicker.set(h.ticker, filers);
      row.instTotalShares = (row.instTotalShares ?? 0) + Number(h.shares ?? 0);
      row.instShareChange = (row.instShareChange ?? 0) + Number(h.changeShares ?? 0);
      if (!row.instReportDate || h.reportDate > row.instReportDate) {
        row.instReportDate = h.reportDate;
      }
    }
    for (const [ticker, filers] of filersByTicker) {
      ensure(ticker).instHolders = filers.size;
    }

    // ── Gov contracts (trailing 1y) ─────────────────────────────────────
    for (const c of contracts) {
      const row = ensure(c.ticker);
      row.govContractUsd1y = (row.govContractUsd1y ?? 0) + Number(c.amountCents ?? 0) / 100;
      row.govContractCount1y = (row.govContractCount1y ?? 0) + 1;
    }

    // ── Lobbying spend (trailing 1y) ────────────────────────────────────
    for (const l of lobbying) {
      if (!l.ticker) continue;
      const row = ensure(l.ticker);
      row.lobbyingUsd1y = (row.lobbyingUsd1y ?? 0) + Number(l.amountCents ?? 0) / 100;
    }

    // ── Patent grants (trailing 1y) ─────────────────────────────────────
    for (const p of patents) {
      const row = ensure(p.ticker);
      row.patentGrants1y = (row.patentGrants1y ?? 0) + 1;
    }

    // ── WSB attention (trailing 30d) ────────────────────────────────────
    const wsbSentimentAcc = new Map<string, { sum: number; n: number }>();
    for (const w of wsb) {
      const row = ensure(w.ticker);
      row.wsbMentions30d = (row.wsbMentions30d ?? 0) + w.mentions;
      if (w.sentiment != null) {
        const acc = wsbSentimentAcc.get(w.ticker) ?? { sum: 0, n: 0 };
        acc.sum += w.sentiment;
        acc.n += 1;
        wsbSentimentAcc.set(w.ticker, acc);
      }
    }
    for (const [ticker, acc] of wsbSentimentAcc) {
      if (acc.n > 0) ensure(ticker).wsbSentiment30d = round2(acc.sum / acc.n);
    }

    // ── Political beta (latest by asOfDate) ─────────────────────────────
    const betaSeen = new Map<string, Date | null>();
    for (const b of beta) {
      const prev = betaSeen.get(b.ticker);
      const isNewer =
        prev === undefined ||
        (b.asOfDate != null && (prev == null || b.asOfDate > prev));
      if (isNewer) {
        ensure(b.ticker).politicalBeta = b.beta;
        betaSeen.set(b.ticker, b.asOfDate ?? null);
      }
    }

    return { rows: [...byTicker.values()], source: "database" };
  } catch (error) {
    console.error("[buyBriefEnrichment] query failed", error);
    return { rows: [], source: "database-error" };
  }
}
