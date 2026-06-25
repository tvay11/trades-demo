import { toCsv } from "@/lib/csv";
import { getScreenerIdeas } from "@/lib/screener/getScreenerIdeas";

const SCREENER_EXPORT_LIMIT = 500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cap = url.searchParams.get("cap") ?? undefined;
  const sector = url.searchParams.get("sector") ?? undefined;
  const minTrades90 = url.searchParams.get("minTrades90") ?? undefined;
  const activity = url.searchParams.get("activity") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.min(SCREENER_EXPORT_LIMIT, Math.max(1, Number(limitParam) || SCREENER_EXPORT_LIMIT))
    : SCREENER_EXPORT_LIMIT;

  const ideas = await getScreenerIdeas({ cap, sector, minTrades90, activity, limit });

  const rows = ideas as unknown as Record<string, unknown>[];

  const csv = toCsv(
    [
      { key: "ticker", label: "Ticker" },
      { key: "companyName", label: "Company" },
      { key: "sector", label: "Sector" },
      { key: "score", label: "Score" },
      { key: "tradeCount90", label: "Trades90d" },
      { key: "tradeCount14", label: "Trades14d" },
      { key: "accel", label: "Accel" },
      { key: "marketCap", label: "MarketCap" },
      {
        key: "tags",
        label: "Tags",
        format: (value) => (Array.isArray(value) ? value.join("; ") : ""),
      },
    ],
    rows,
  );

  const filename = `screener-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Exported-Rows": String(ideas.length),
      "X-Export-Limit": String(limit),
    },
  });
}
