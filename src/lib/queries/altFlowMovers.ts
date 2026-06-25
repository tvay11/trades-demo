import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { shapeDarkShort } from "@/lib/ledger/altFlow";

// ─── Pure shaping ────────────────────────────────────────────────────────────

export interface WsbSurgeRow {
  ticker: string;
  mentions7d: number;
  mentionsPrior7d: number;
  surgeRatio: number;
}

/**
 * Filter rows with a sufficient base (prior >= 10), compute ratio = 7d/prior,
 * sort descending, return top N with surgeRatio rounded to 1 decimal.
 */
export function topWsbSurges(
  rows: { ticker: string; mentions7d: number; mentionsPrior7d: number }[],
  limit: number,
): WsbSurgeRow[] {
  return rows
    .filter((r) => r.mentionsPrior7d >= 10)
    .map((r) => ({
      ...r,
      surgeRatio: Math.round((r.mentions7d / r.mentionsPrior7d) * 10) / 10,
    }))
    .sort((a, b) => b.surgeRatio - a.surgeRatio)
    .slice(0, limit);
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface DarkShortSpike {
  ticker: string;
  latestShortVolPct: number;
  excessPp: number;
}

export interface GovContractMover {
  ticker: string;
  agency: string | null;
  amountUsd: number;
  date: string | null;
}

export interface AltFlowMovers {
  wsbSurges: WsbSurgeRow[];
  darkShortSpikes: DarkShortSpike[];
  govContracts: GovContractMover[];
}

// Module-level memo: 600 seconds TTL, resets when at least one block non-empty
let _cache: { at: number; data: AltFlowMovers } | null = null;
const CACHE_TTL = 600_000;

type WsbRawRow = { ticker: string; mentions7d: number; mentionsPrior7d: number };
type OffExchangeRawRow = { ticker: string; date: Date; shortVolumePercent: number | null };

export async function getAltFlowMovers(): Promise<AltFlowMovers> {
  const now = Date.now();
  if (_cache && now - _cache.at < CACHE_TTL) return _cache.data;

  const result: AltFlowMovers = { wsbSurges: [], darkShortSpikes: [], govContracts: [] };

  // ── Block 1: WSB surges ───────────────────────────────────────────────────
  try {
    const nowDate = new Date();
    const cut14 = new Date(nowDate.getTime() - 14 * 86_400_000);
    const cut7  = new Date(nowDate.getTime() - 7  * 86_400_000);

    // Raw SQL: aggregate WsbMention into 7d and prior-7d windows per ticker
    const wsbRaw = await db.$queryRaw<WsbRawRow[]>`
      SELECT
        "ticker",
        SUM(CASE WHEN "date" >= ${cut7}  THEN "mentions" ELSE 0 END) AS "mentions7d",
        SUM(CASE WHEN "date" >= ${cut14} AND "date" < ${cut7} THEN "mentions" ELSE 0 END) AS "mentionsPrior7d"
      FROM "WsbMention"
      WHERE "date" >= ${cut14}
      GROUP BY "ticker"
    `;

    // BigInt coercion safety (SQLite may return BigInt for aggregates)
    const coerced = wsbRaw.map((r) => ({
      ticker: r.ticker,
      mentions7d: Number(r.mentions7d),
      mentionsPrior7d: Number(r.mentionsPrior7d),
    }));

    result.wsbSurges = topWsbSurges(coerced, 6);
  } catch (e) {
    console.warn("[altFlowMovers] wsb block failed:", (e as Error).message);
  }

  // ── Block 2: Dark short spikes ────────────────────────────────────────────
  try {
    const nowDate = new Date();
    const cut7 = new Date(nowDate.getTime() - 7 * 86_400_000);

    // Find candidate tickers with recent activity (last 7d), cap at 200
    const candidateRows = await db.$queryRaw<{ ticker: string }[]>`
      SELECT DISTINCT "ticker"
      FROM "OffExchangeActivity"
      WHERE "date" >= ${cut7}
      LIMIT 200
    `;
    const tickers = candidateRows.map((r) => r.ticker);

    if (tickers.length > 0) {
      // Batch fetch last ~21 rows per ticker ordered by ticker, date desc
      const offRows = await db.$queryRaw<OffExchangeRawRow[]>`
        SELECT "ticker", "date", "shortVolumePercent"
        FROM "OffExchangeActivity"
        WHERE "ticker" IN (${Prisma.join(tickers)})
        ORDER BY "ticker" ASC, "date" DESC
      `;

      // Group rows by ticker (already sorted ticker asc, date desc)
      const byTicker = new Map<string, OffExchangeRawRow[]>();
      for (const r of offRows) {
        const list = byTicker.get(r.ticker) ?? [];
        list.push(r);
        byTicker.set(r.ticker, list);
      }

      const spikes: DarkShortSpike[] = [];
      for (const [ticker, rows] of byTicker) {
        const shaped = shapeDarkShort(rows.slice(0, 21).map((r) => ({ date: r.date, shortVolumePercent: r.shortVolumePercent })));
        if (
          shaped &&
          shaped.excessPp != null &&
          shaped.excessPp >= 5 &&
          shaped.latestShortVolPct != null
        ) {
          spikes.push({
            ticker,
            latestShortVolPct: shaped.latestShortVolPct,
            excessPp: shaped.excessPp,
          });
        }
      }

      result.darkShortSpikes = spikes
        .sort((a, b) => b.excessPp - a.excessPp)
        .slice(0, 6);
    }
  } catch (e) {
    console.warn("[altFlowMovers] darkShort block failed:", (e as Error).message);
  }

  // ── Block 3: Gov contracts ────────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const govRows = await db.govContract.findMany({
      where: { awardedAt: { gte: cutoff }, amountCents: { not: null } },
      orderBy: { amountCents: "desc" },
      take: 6,
      select: { ticker: true, agency: true, amountCents: true, awardedAt: true },
    });

    result.govContracts = govRows.map((r) => ({
      ticker: r.ticker,
      agency: r.agency,
      amountUsd: Number(r.amountCents ?? 0n) / 100,
      date: r.awardedAt ? r.awardedAt.toISOString().slice(0, 10) : null,
    }));
  } catch (e) {
    console.warn("[altFlowMovers] govContracts block failed:", (e as Error).message);
  }

  // Cache if at least one block produced results
  if (
    result.wsbSurges.length > 0 ||
    result.darkShortSpikes.length > 0 ||
    result.govContracts.length > 0
  ) {
    _cache = { at: now, data: result };
  }

  return result;
}
