import { toCsv } from "@/lib/csv";
import {
  getStocksList,
  STOCKS_EXPORT_LIMIT,
  type StockListSortDir,
  type StockListSortKey,
} from "@/lib/queries/stocksList";

const SORTABLE = new Set<StockListSortKey>([
  "ticker",
  "companyName",
  "industry",
  "country",
  "marketCap",
  "tradeCount14",
  "tradeCount30",
  "tradeCount60",
  "tradeCount90",
  "tradeCount365",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort") as StockListSortKey | null;
  const sort = sortParam && SORTABLE.has(sortParam) ? sortParam : "marketCap";
  const dir: StockListSortDir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";

  const result = await getStocksList({
    q: url.searchParams.get("q") ?? undefined,
    sort,
    dir,
    page: 1,
    pageSize: STOCKS_EXPORT_LIMIT,
    sector: url.searchParams.get("sector") ?? undefined,
    cap: url.searchParams.get("cap") ?? undefined,
    activity: url.searchParams.get("activity") ?? undefined,
    exchange: url.searchParams.get("exchange") ?? undefined,
    industry: url.searchParams.get("industry") ?? undefined,
    country: url.searchParams.get("country") ?? undefined,
    profile: url.searchParams.get("profile") ?? undefined,
    minTrades90: url.searchParams.get("minTrades90") ?? undefined,
  });

  const csv = toCsv(
    [
      { key: "ticker", label: "Ticker" },
      { key: "companyName", label: "Company" },
      { key: "sector", label: "Sector" },
      { key: "industry", label: "Industry" },
      { key: "country", label: "Country" },
      { key: "marketCap", label: "Market Cap" },
      { key: "tradeCount14", label: "Trades 14d" },
      { key: "tradeCount30", label: "Trades 30d" },
      { key: "tradeCount60", label: "Trades 60d" },
      { key: "tradeCount90", label: "Trades 90d" },
      { key: "tradeCount365", label: "Trades 1y" },
    ],
    result.rows,
  );
  const filename = `stocks-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Total-Rows": String(result.total),
      "X-Exported-Rows": String(result.rows.length),
      "X-Export-Limit": String(STOCKS_EXPORT_LIMIT),
      "X-Export-Truncated": String(result.total > result.rows.length),
    },
  });
}
