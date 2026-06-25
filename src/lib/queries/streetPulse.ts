import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type MoverRow = {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
};

export type SectorCell = {
  symbol: string;
  changePct: number | null;
};

export type StreetPulse = {
  gainers: MoverRow[];
  losers: MoverRow[];
  actives: MoverRow[];
  sectors: SectorCell[];
};

const SECTOR_ETFS = [
  "XLK",
  "XLF",
  "XLE",
  "XLV",
  "XLI",
  "XLY",
  "XLP",
  "XLU",
  "XLB",
  "XLRE",
  "XLC",
];

type ScreenerId = "day_gainers" | "day_losers" | "most_actives";

type LooseScreenerResult = {
  quotes?: unknown[];
};

const SCREENER_MODULE_OPTIONS = { validateResult: false } as const;

function shapeScreenerQuotes(
  quotes: unknown[] | undefined,
  limit: number,
): MoverRow[] {
  return (quotes ?? []).flatMap((raw) => {
    const q = raw as {
      symbol?: unknown;
      shortName?: unknown;
      longName?: unknown;
      regularMarketPrice?: unknown;
      regularMarketChangePercent?: unknown;
    };
    if (
      typeof q.symbol !== "string" ||
      !Number.isFinite(q.regularMarketPrice) ||
      !Number.isFinite(q.regularMarketChangePercent)
    ) {
      return [];
    }
    const name = typeof q.shortName === "string"
      ? q.shortName
      : typeof q.longName === "string"
        ? q.longName
        : q.symbol;
    return [{
      ticker: q.symbol,
      name,
      price: q.regularMarketPrice as number,
      changePct: q.regularMarketChangePercent as number,
    }];
  }).slice(0, limit);
}

async function fetchScreenerRows(scrIds: ScreenerId): Promise<MoverRow[]> {
  const result = await yf.screener(
    { scrIds, count: 6 },
    undefined,
    SCREENER_MODULE_OPTIONS,
  ) as LooseScreenerResult;
  return shapeScreenerQuotes(result.quotes, 6);
}

const TTL_MS = 600_000;
let memo: { at: number; data: StreetPulse } | null = null;

export async function getStreetPulse(): Promise<StreetPulse> {
  const now = Date.now();
  if (memo && now - memo.at < TTL_MS) return memo.data;

  const [gainers, losers, actives, sectors] = await Promise.all([
    (async (): Promise<MoverRow[]> => {
      try {
        return await fetchScreenerRows("day_gainers");
      } catch (e) {
        console.warn("[streetPulse] day_gainers failed:", (e as Error).message);
        return [];
      }
    })(),
    (async (): Promise<MoverRow[]> => {
      try {
        return await fetchScreenerRows("day_losers");
      } catch (e) {
        console.warn("[streetPulse] day_losers failed:", (e as Error).message);
        return [];
      }
    })(),
    (async (): Promise<MoverRow[]> => {
      try {
        return await fetchScreenerRows("most_actives");
      } catch (e) {
        console.warn("[streetPulse] most_actives failed:", (e as Error).message);
        return [];
      }
    })(),
    (async (): Promise<SectorCell[]> => {
      try {
        const quotes = await yf.quote(SECTOR_ETFS);
        const raw = Array.isArray(quotes) ? quotes : [quotes];
        return raw.map((q) => ({
          symbol: (q as { symbol?: string }).symbol ?? "",
          changePct: Number.isFinite(
            (q as { regularMarketChangePercent?: number }).regularMarketChangePercent,
          )
            ? ((q as { regularMarketChangePercent: number }).regularMarketChangePercent)
            : null,
        }));
      } catch (e) {
        console.warn("[streetPulse] sector ETF quote failed:", (e as Error).message);
        return [];
      }
    })(),
  ]);

  const data: StreetPulse = { gainers, losers, actives, sectors };

  // Only cache if at least one sub-block has data
  const hasData =
    gainers.length > 0 || losers.length > 0 || actives.length > 0 || sectors.length > 0;
  if (hasData) {
    memo = { at: now, data };
  }

  return data;
}
