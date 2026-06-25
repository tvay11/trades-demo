import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type TapeSymbolEntry = { symbol: string; label: string };

export const TAPE_SYMBOLS: TapeSymbolEntry[] = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow" },
  { symbol: "^RUT", label: "Russell 2k" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "^TNX", label: "10Y" },
  { symbol: "DX-Y.NYB", label: "DXY" },
  { symbol: "GC=F", label: "Gold" },
  { symbol: "CL=F", label: "Oil" },
  { symbol: "BTC-USD", label: "BTC" },
];

const LABEL_MAP = new Map(TAPE_SYMBOLS.map((s) => [s.symbol, s.label]));

export type TapeCell = {
  symbol: string;
  label: string;
  price: number;
  changePct: number | null;
};

type RawQuote = {
  regularMarketPrice?: number | null;
  regularMarketChangePercent?: number | null;
};

export function shapeTapeQuote(symbol: string, q: RawQuote): TapeCell | null {
  const price = q.regularMarketPrice;
  if (price == null || !Number.isFinite(price)) return null;
  const label = LABEL_MAP.get(symbol) ?? symbol;
  const changePct = Number.isFinite(q.regularMarketChangePercent)
    ? (q.regularMarketChangePercent as number)
    : null;
  return { symbol, label, price, changePct };
}

const TTL_MS = 180_000;
let memo: { at: number; data: TapeCell[] } | null = null;

export async function getMarketTape(): Promise<TapeCell[]> {
  const now = Date.now();
  if (memo && now - memo.at < TTL_MS) return memo.data;

  try {
    const symbols = TAPE_SYMBOLS.map((s) => s.symbol);
    const quotes = await yf.quote(symbols);
    const raw = Array.isArray(quotes) ? quotes : [quotes];
    const data = raw
      .map((q) => shapeTapeQuote((q as { symbol?: string }).symbol ?? "", q as RawQuote))
      .filter((c): c is TapeCell => c !== null);
    memo = { at: now, data };
    return data;
  } catch (e) {
    console.warn("[marketTape] getMarketTape failed:", (e as Error).message);
    return [];
  }
}
