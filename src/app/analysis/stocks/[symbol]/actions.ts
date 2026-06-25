"use server";

import { generateReport } from "@/lib/ledger/generateReport";

export async function createReportAction(ticker: string) {
  return generateReport(ticker);
}
