import { applyCacheLife, applyCacheTag } from "@/lib/cache";
import { db } from "@/lib/db";
import { normalizeGeoScore } from "./geoScore";
import { normalizeNewsScore } from "./newsScore";
import type { GeoFactor, GeoImpact, Ledger, NewsItem } from "./types";

type StoredGeoFactor = Omit<GeoFactor, "score"> & {
  score?: unknown;
  magnitude?: unknown;
};

function normalizeGeopolitical(geo: Partial<Ledger>["geopolitical"] | undefined): GeoImpact | null {
  if (!geo) return null;
  return {
    ...geo,
    factors: Array.isArray(geo.factors)
      ? geo.factors.map((factor) => {
          const stored = factor as StoredGeoFactor;
          const { magnitude: _magnitude, ...rest } = stored;
          return {
            ...rest,
            score: normalizeGeoScore(stored.score, _magnitude),
          };
        })
      : [],
  };
}

type StoredNewsItem = Omit<NewsItem, "score"> & {
  score?: unknown;
};

function normalizeNewsItems(news: Partial<Ledger>["news"] | undefined): NewsItem[] {
  if (!Array.isArray(news)) return [];
  return news.map((item) => {
    const stored = item as StoredNewsItem;
    return {
      ...stored,
      score: normalizeNewsScore(stored.score),
    };
  });
}

export function normalizeLedgerSnapshot(raw: Ledger): Ledger {
  const snapshot = raw as Partial<Ledger>;

  if (snapshot.forecast) {
    snapshot.forecast.suspect = snapshot.forecast.suspect ?? false;
    snapshot.forecast.suspectReason = snapshot.forecast.suspectReason ?? null;
  }

  return {
    ...raw,
    houseCall: {
      ...raw.houseCall,
      score: snapshot.houseCall?.score ?? 0,
      contributions: Array.isArray(snapshot.houseCall?.contributions)
        ? snapshot.houseCall.contributions
        : [],
    },
    analystNote: snapshot.analystNote ?? null,
    analystAnalysis: snapshot.analystAnalysis ?? null,
    news: normalizeNewsItems(snapshot.news),
    geopolitical: normalizeGeopolitical(snapshot.geopolitical),
    fundamentalsInsight: snapshot.fundamentalsInsight ?? null,
    longTermPlay: snapshot.longTermPlay ?? null,
    officialTrades: Array.isArray(snapshot.officialTrades) ? snapshot.officialTrades : [],
    insiderTrades: Array.isArray(snapshot.insiderTrades) ? snapshot.insiderTrades : [],
    macro: snapshot.macro ?? null,
    options: snapshot.options ?? null,
    valuation: snapshot.valuation ?? null,
    analyst: snapshot.analyst ?? null,
    shortInterest: snapshot.shortInterest ?? null,
    nextEarnings: snapshot.nextEarnings ?? null,
    tradeLens: snapshot.tradeLens ?? null,
    forecastTrackRecord: snapshot.forecastTrackRecord ?? null,
    streetMomentum: snapshot.streetMomentum ?? null,
    altFlow: snapshot.altFlow ?? null,
    riskShift: snapshot.riskShift ?? null,
  };
}

export async function getReport(ticker: string): Promise<Ledger | null> {
  "use cache";
  applyCacheLife("minutes");

  const symbol = ticker.trim().toUpperCase();
  applyCacheTag(`report:${symbol}`);
  try {
    const rows = await db.report.findMany({
      where: { ticker: symbol },
      orderBy: { generatedAt: "desc" },
      take: 1,
    });
    console.log(
      `[getReport] ${symbol}: ${rows.length ? "snapshot found (generatedAt " + rows[0].generatedAt + ")" : "no snapshot"}`,
    );
    if (rows.length === 0) return null;
    return normalizeLedgerSnapshot(JSON.parse(rows[0].payload) as Ledger);
  } catch (error) {
    console.error("[getReport] failed", error);
    return null;
  }
}
