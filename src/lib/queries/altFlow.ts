import { db } from "@/lib/db";
import { assembleAltFlow, shapeDarkShort, shapeGovContracts, shapeThirteenF, shapeWsb } from "@/lib/ledger/altFlow";
import type { AltFlow } from "@/lib/ledger/types";

export async function getAltFlow(ticker: string): Promise<AltFlow | null> {
  try {
    const now = new Date();
    const [wsbRows, offRows, tfRows, govRows] = await Promise.all([
      db.wsbMention.findMany({ where: { ticker, date: { gte: new Date(now.getTime() - 14 * 86_400_000) } }, orderBy: { date: "desc" } }),
      db.offExchangeActivity.findMany({ where: { ticker }, orderBy: { date: "desc" }, take: 21 }),
      db.thirteenFHolding.findMany({ where: { ticker }, orderBy: { reportDate: "desc" }, take: 400 }),
      db.govContract.findMany({ where: { ticker }, orderBy: { awardedAt: "desc" }, take: 50 }),
    ]);
    return assembleAltFlow({
      wsb: shapeWsb(wsbRows.map((r) => ({ date: r.date, mentions: r.mentions, sentiment: r.sentiment })), now),
      darkShort: shapeDarkShort(offRows.map((r) => ({ date: r.date, shortVolumePercent: r.shortVolumePercent }))),
      thirteenF: shapeThirteenF(tfRows.map((r) => ({ filer: r.filer, changeShares: r.changeShares, valueCents: r.valueCents, reportDate: r.reportDate }))),
      govContracts: shapeGovContracts(govRows.map((r) => ({ agency: r.agency, amountCents: r.amountCents, awardedAt: r.awardedAt })), now),
    });
  } catch (e) {
    console.error(`[altFlow] query failed for ${ticker}:`, (e as Error).message);
    return null;
  }
}
