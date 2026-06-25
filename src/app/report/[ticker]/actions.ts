"use server";

import { generateReport } from "@/lib/ledger/generateReport";
import { refreshForecast } from "@/lib/ledger/refreshForecast";
import { askReport } from "@/lib/ledger/askReport";

export async function remakeReportAction(ticker: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") {
    return { ok: false, ticker, error: "Regeneration is disabled in the Demo Version." };
  }
  return generateReport(ticker);
}

export async function refreshForecastAction(ticker: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") {
    return { ok: false, ticker, error: "Forecast refresh is disabled in the Demo Version." };
  }
  return refreshForecast(ticker);
}

export async function askReportAction(ticker: string, question: string) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "false") {
    return { ok: false, error: "AI chat is disabled in the Demo Version. Connect your DeepSeek API key to chat with the report." };
  }
  return askReport(ticker, question);
}
