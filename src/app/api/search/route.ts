import { NextResponse } from "next/server";

import { searchSqlFirst } from "@/lib/queries/appData";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("q")?.trim() ?? "";

  if (!raw) {
    return NextResponse.json({ politicians: [], trades: [], tickers: [] });
  }
  if (raw.length > 100) {
    return NextResponse.json({ error: "q too long" }, { status: 400 });
  }
  const q = raw.toLowerCase();

  const sqlResults = await searchSqlFirst(q);
  if (sqlResults) return NextResponse.json(sqlResults);

  // No mock fallback — return empty results when SQL finds nothing
  return NextResponse.json({ politicians: [], trades: [], tickers: [] });
}
