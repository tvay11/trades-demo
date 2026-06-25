import { createHash } from "node:crypto";

export type TradeHashInput = {
  name: string;
  ticker: string;
  date: string;
  type: string;
  amount: string;
};

export function tradeHash(t: TradeHashInput): string {
  const key = [
    t.name.trim().toLowerCase(),
    t.ticker.trim().toLowerCase(),
    t.date.trim(),
    t.type.trim().toLowerCase(),
    t.amount.trim().toLowerCase(),
  ].join("|");
  return createHash("sha256").update(key).digest("hex");
}
