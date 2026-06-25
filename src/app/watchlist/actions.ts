"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { normalizeWatchlistTicker } from "@/lib/watchlist";

export async function addToWatchlist(formData: FormData) {
  const ticker = normalizeWatchlistTicker(formData.get("ticker"));
  if (!ticker) return;

  await db.$executeRaw`
    INSERT INTO "WatchlistItem" ("ticker", "updatedAt")
    VALUES (${ticker}, CURRENT_TIMESTAMP)
    ON CONFLICT("ticker") DO NOTHING
  `;

  revalidateWatchlistPaths(ticker);
}

export async function removeFromWatchlist(formData: FormData) {
  const ticker = normalizeWatchlistTicker(formData.get("ticker"));
  if (!ticker) return;

  await db.$executeRaw`
    DELETE FROM "WatchlistItem" WHERE "ticker" = ${ticker}
  `;
  revalidateWatchlistPaths(ticker);
}

function revalidateWatchlistPaths(ticker: string) {
  revalidatePath("/watchlist");
  revalidatePath("/stocks");
  revalidatePath("/analysis/stocks");
  revalidatePath(`/analysis/stocks/${encodeURIComponent(ticker)}`);
  revalidatePath("/report/[ticker]", "page");
}
