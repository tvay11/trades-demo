/**
 * Canonical buy/sell classifier covering both word-form labels (congressional
 * and executive disclosures) and SEC Form 4 codes (corporate insider trades).
 *
 * Word forms: "Purchase", "Buy", "Sale", "Sale (Full)", "Sale (Partial)",
 *   "Sell". Matched via substring so "Sale (Partial)" still resolves.
 *
 * SEC Form 4: InsiderTrade.transactionType stores either a bare code ("P",
 *   "S") or a composite of TransactionCode/AcquiredDisposedCode ("P/A",
 *   "S/D"). We match the first token (split on `/`, space, or `-`) so a
 *   leading "P" / "S" routes to buy / sell. Other codes (M=exercise,
 *   G=gift, A or D alone without a transaction code) intentionally fall
 *   through to "other" since they're not directional open-market activity.
 *
 * Was duplicated across ~6 query modules; only the dualInsider copy tried
 * to handle SEC codes and used the wrong pattern ("p -" / "s -"), which
 * caused the dual-insider page to drop every insider row into "other".
 */
export function classifyAction(value: string | null | undefined): "buy" | "sell" | "other" {
  const t = (value ?? "").trim().toLowerCase();
  if (!t) return "other";
  if (t.includes("purchase") || t.includes("buy")) return "buy";
  if (t.includes("sale") || t.includes("sell")) return "sell";
  const firstCode = t.split(/[/ -]/, 1)[0];
  if (firstCode === "p") return "buy";
  if (firstCode === "s") return "sell";
  return "other";
}
