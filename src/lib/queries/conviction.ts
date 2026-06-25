import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { CommitteeContext } from "@/lib/committees/relevance";
import { scoreCommitteeRelevance } from "@/lib/committees/relevance";
import { shapeDarkShort } from "@/lib/ledger/altFlow";
import { minimumDollars } from "@/lib/money";
import { classifyAction } from "@/lib/trades/classify";
import { rollupTickerConviction, type ScoredTrade, type TickerConviction } from "@/lib/analysis/convictionRollup";
import { scoreTrade } from "@/lib/analysis/convictionScore";
import { getTrackRecords } from "@/lib/queries/trackRecords";

const DAY_MS = 86_400_000;

type OffExchangeRow = { ticker: string; date: Date; shortVolumePercent: number | null };
type InsiderRow = { ticker: string; transactionType: string; filingDate: Date | null; transactionDate: Date };

export async function getTickerConviction(
  tickers: string[],
): Promise<Map<string, TickerConviction>> {
  if (!tickers.length) return new Map();

  const normalized = [...new Set(tickers.map((t) => t.toUpperCase()))];
  const now = new Date();
  const since = new Date(now.getTime() - 30 * DAY_MS);

  try {
    // ── 1. Congress trades with committee data ─────────────────────────
    const congressRows = await db.congressTrade.findMany({
      where: { ticker: { in: normalized }, disclosureDate: { gte: since } },
      select: {
        id: true,
        ticker: true,
        representative: true,
        politician: { select: { name: true, committees: { include: { committee: { select: { name: true } } } } } },
        transactionType: true,
        disclosureDate: true,
        amountMinCents: true,
        amountMaxCents: true,
      },
    });

    if (!congressRows.length) return new Map();

    // ── 2. Stock sector/industry for committee relevance ───────────────
    const uniqueTickers = [...new Set(congressRows.map((r) => r.ticker))];
    const stocks = await db.stock.findMany({
      where: { ticker: { in: uniqueTickers } },
      select: { ticker: true, sector: true, industry: true },
    });
    const stockByTicker = new Map(stocks.map((s) => [s.ticker, s]));

    // Committee-linked trade IDs (label !== "Low")
    const committeeLinkedIds = new Set<number>();
    for (const row of congressRows) {
      const stock = stockByTicker.get(row.ticker);
      const committees: CommitteeContext[] = row.politician.committees.map((a) => ({
        name: a.committee.name,
        role: a.role,
        isChair: a.isChair,
        isRanking: a.isRanking,
      }));
      const relevance = scoreCommitteeRelevance({
        ticker: row.ticker,
        sector: stock?.sector,
        industry: stock?.industry,
        committees,
      });
      if (relevance.label !== "Low") committeeLinkedIds.add(row.id);
    }

    // ── 3. Track records (all) ─────────────────────────────────────────
    const trackRecords = await getTrackRecords();

    // ── 4. Dual-insider: per-ticker direction map ──────────────────────
    const insiderRows = await db.$queryRaw<InsiderRow[]>`
      SELECT "ticker", "transactionType",
             "filingDate", "transactionDate"
      FROM "InsiderTrade"
      WHERE "ticker" IN (${Prisma.join(normalized)})
        AND (
          "filingDate" >= ${since}
          OR ("filingDate" IS NULL AND "transactionDate" >= ${since})
        )
    `;

    // net volume per ticker from insiders
    const insiderNet = new Map<string, number>();
    for (const r of insiderRows) {
      const action = classifyAction(r.transactionType);
      if (action === "other") continue;
      const cur = insiderNet.get(r.ticker) ?? 0;
      insiderNet.set(r.ticker, cur + (action === "buy" ? 1 : -1));
    }

    // ── 5. Dark flow: batch fetch offExchangeActivity ──────────────────
    const offRows = await db.$queryRaw<OffExchangeRow[]>`
      SELECT "ticker", "date", "shortVolumePercent"
      FROM "OffExchangeActivity"
      WHERE "ticker" IN (${Prisma.join(normalized)})
      ORDER BY "date" DESC
    `;

    const offByTicker = new Map<string, OffExchangeRow[]>();
    for (const r of offRows) {
      const list = offByTicker.get(r.ticker) ?? [];
      list.push(r);
      offByTicker.set(r.ticker, list);
    }
    // shapeDarkShort expects the rows sorted desc (most-recent first) — already ordered above
    const darkByTicker = new Map<string, number | null>();
    for (const [ticker, rows] of offByTicker) {
      const shaped = shapeDarkShort(rows.slice(0, 21).map((r) => ({ date: r.date, shortVolumePercent: r.shortVolumePercent })));
      darkByTicker.set(ticker, shaped?.excessPp ?? null);
    }

    // ── 6. Score each trade, rollup, return ───────────────────────────
    const scored: ScoredTrade[] = [];
    for (const row of congressRows) {
      const action = classifyAction(row.transactionType);
      if (action === "other") continue;
      const side = action === "buy" ? "long" : ("short" as const);

      const daysSinceDisclosure = Math.floor((now.getTime() - row.disclosureDate.getTime()) / DAY_MS);
      const amountMinDollars = minimumDollars(row.amountMinCents, row.amountMaxCents);
      const canonicalName = row.politician?.name ?? row.representative;
      const tr = trackRecords.get(canonicalName) ?? null;
      const trackRecord = tr
        ? { samples: tr.samples, hitRate30: tr.hitRate30, avgExcess30: tr.avgExcess30 }
        : null;

      const committeeLinked = committeeLinkedIds.has(row.id);

      // Dual-insider confirmed: insider net on same ticker matches trade side
      const insiderNetVal = insiderNet.get(row.ticker) ?? 0;
      const dualInsiderConfirmed =
        (side === "long" && insiderNetVal > 0) || (side === "short" && insiderNetVal < 0);

      const darkFlowExcessPp = darkByTicker.get(row.ticker) ?? null;

      const { score, breakdown } = scoreTrade({
        side,
        daysSinceDisclosure,
        amountMinDollars,
        trackRecord,
        committeeLinked,
        dualInsiderConfirmed,
        darkFlowExcessPp,
      });

      scored.push({ ticker: row.ticker, side, score, breakdown, tradeId: row.id });
    }

    const rollup = rollupTickerConviction(scored);
    return new Map(rollup.map((r) => [r.ticker, r]));
  } catch (err) {
    console.warn("[conviction] query failed:", (err as Error).message);
    return new Map();
  }
}
