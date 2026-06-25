import { db } from "@/lib/db";
import { extractReportSignals, type ReportSignals } from "@/lib/queries/reportSignals";
import { getLongShortAnalysis } from "@/lib/queries/marketSignalData";
import { getTickerConviction } from "@/lib/queries/conviction";
import type { TickerConviction } from "@/lib/analysis/convictionRollup";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Returns "rating" when the report rating changed, null otherwise.
 *  Returns null when previous is null (no baseline to diff against). */
export function diffReportSignals(
  current: ReportSignals,
  previous: ReportSignals | null,
): "rating" | null {
  if (previous === null) return null;
  if (current.rating !== previous.rating) return "rating";
  return null;
}

export type MorningBriefRow = {
  ticker: string;
  price: number | null;
  changePct: number | null;
  signals: ReportSignals | null;
  changed: "rating" | null;
  reportAgeDays: number | null;
};

const CAP = 24;
const TTL_MS = 180_000;
let memo: { at: number; data: MorningBriefRow[] } | null = null;

export async function getMorningBriefTickers(): Promise<MorningBriefRow[]> {
  const now = Date.now();
  if (memo && now - memo.at < TTL_MS) return memo.data;

  try {
    // 1. Gather ticker universe: watchlist ∪ distinct Report tickers
    const [watchlistRows, reportTickerRows] = await Promise.all([
      db.$queryRaw<Array<{ ticker: string }>>`
        SELECT "ticker" FROM "WatchlistItem" ORDER BY "createdAt" DESC
      `,
      db.$queryRaw<Array<{ ticker: string }>>`
        SELECT DISTINCT "ticker" FROM "Report"
      `,
    ]);

    const seen = new Set<string>();
    const tickers: string[] = [];
    for (const row of [...watchlistRows, ...reportTickerRows]) {
      const t = row.ticker.toUpperCase();
      if (!seen.has(t)) {
        seen.add(t);
        tickers.push(t);
        if (tickers.length >= CAP) break;
      }
    }

    if (tickers.length === 0) {
      memo = { at: now, data: [] };
      return [];
    }

    // 2. Fetch two most recent Report rows per ticker
    const placeholders = tickers.map(() => "?").join(",");
    const reportRows = await db.$queryRawUnsafe<
      Array<{ ticker: string; generatedAt: string; payload: string }>
    >(
      `SELECT ticker, generatedAt, payload FROM Report
       WHERE ticker IN (${placeholders})
       ORDER BY id DESC`,
      ...tickers,
    );

    // Group into first two per ticker (latest, previous)
    const reportsByTicker = new Map<
      string,
      Array<{ generatedAt: string; payload: string }>
    >();
    for (const row of reportRows) {
      const t = row.ticker.toUpperCase();
      const arr = reportsByTicker.get(t) ?? [];
      if (arr.length < 2) {
        arr.push({ generatedAt: row.generatedAt, payload: row.payload });
        reportsByTicker.set(t, arr);
      }
    }

    // 3. Batch live quotes
    const quoteMap = new Map<string, { price: number | null; changePct: number | null }>();
    try {
      const quotes = await yf.quote(tickers);
      const raw = (Array.isArray(quotes) ? quotes : [quotes]) as Array<{
        symbol?: string;
        regularMarketPrice?: number | null;
        regularMarketChangePercent?: number | null;
      }>;
      for (const q of raw) {
        const sym = (q.symbol ?? "").toUpperCase();
        if (!sym) continue;
        const price =
          q.regularMarketPrice != null && Number.isFinite(q.regularMarketPrice)
            ? q.regularMarketPrice
            : null;
        const changePct =
          q.regularMarketChangePercent != null &&
          Number.isFinite(q.regularMarketChangePercent)
            ? q.regularMarketChangePercent
            : null;
        quoteMap.set(sym, { price, changePct });
      }
    } catch (e) {
      console.warn("[morningBrief] yf.quote failed:", (e as Error).message);
    }

    // 4. Assemble rows
    const today = Date.now();
    const rows: MorningBriefRow[] = tickers.map((ticker) => {
      const reports = reportsByTicker.get(ticker) ?? [];
      const latestSignals =
        reports[0] ? extractReportSignals(reports[0].payload, reports[0].generatedAt) : null;
      const prevSignals =
        reports[1] ? extractReportSignals(reports[1].payload, reports[1].generatedAt) : null;

      const changed = latestSignals ? diffReportSignals(latestSignals, prevSignals) : null;

      let reportAgeDays: number | null = null;
      if (latestSignals?.generatedAt) {
        const genMs = new Date(latestSignals.generatedAt).getTime();
        if (!Number.isNaN(genMs)) {
          reportAgeDays = Math.floor((today - genMs) / 86_400_000);
        }
      }

      const q = quoteMap.get(ticker) ?? { price: null, changePct: null };

      return {
        ticker,
        price: q.price,
        changePct: q.changePct,
        signals: latestSignals,
        changed,
        reportAgeDays,
      };
    });

    // 5. Sort: changed-first, then reportAgeDays asc (nulls last)
    rows.sort((a, b) => {
      const aChanged = a.changed !== null ? 0 : 1;
      const bChanged = b.changed !== null ? 0 : 1;
      if (aChanged !== bChanged) return aChanged - bChanged;
      if (a.reportAgeDays === null && b.reportAgeDays === null) return 0;
      if (a.reportAgeDays === null) return 1;
      if (b.reportAgeDays === null) return -1;
      return a.reportAgeDays - b.reportAgeDays;
    });

    memo = { at: now, data: rows };
    return rows;
  } catch (e) {
    console.warn("[morningBrief] getMorningBriefTickers failed:", (e as Error).message);
    return [];
  }
}

// ── New Ideas ──────────────────────────────────────────────────────────────

export type NewIdeaRow = {
  ticker: string;
  stance: "Long" | "Short";
  score: number;
  conviction: TickerConviction | null;
};

export type NewIdeas = {
  longs: NewIdeaRow[];
  shorts: NewIdeaRow[];
};

const IDEAS_TTL_MS = 180_000;
let ideasMemo: { at: number; data: NewIdeas } | null = null;

/** Top 5 long + top 5 short from the long/short scanner, each decorated with
 *  conviction data. Fail-soft → { longs: [], shorts: [] }. */
export async function getNewIdeas(): Promise<NewIdeas> {
  const now = Date.now();
  if (ideasMemo && now - ideasMemo.at < IDEAS_TTL_MS) return ideasMemo.data;

  try {
    const analysis = await getLongShortAnalysis();
    const all = analysis.all;

    const longs = [...all]
      .filter((c) => c.stance === "Long")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const shorts = [...all]
      .filter((c) => c.stance === "Short")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const tickers = [...longs, ...shorts].map((c) => c.ticker);
    const convictionMap = tickers.length > 0 ? await getTickerConviction(tickers) : new Map<string, TickerConviction>();

    const toRow = (c: (typeof all)[number]): NewIdeaRow => ({
      ticker: c.ticker,
      stance: c.stance as "Long" | "Short",
      score: c.score,
      conviction: convictionMap.get(c.ticker) ?? null,
    });

    const data: NewIdeas = {
      longs: longs.map(toRow),
      shorts: shorts.map(toRow),
    };
    ideasMemo = { at: now, data };
    return data;
  } catch (e) {
    console.warn("[morningBrief] getNewIdeas failed:", (e as Error).message);
    return { longs: [], shorts: [] };
  }
}
