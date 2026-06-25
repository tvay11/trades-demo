import type { Branch } from "@/lib/trades/unified";

/**
 * Parses an id from URL params into a branch + numeric DB id.
 *
 * Accepted forms:
 *   "cong-123"  -> { branch: "congress",  numericId: 123 }
 *   "exec-456"  -> { branch: "executive", numericId: 456 }
 *   "123"       -> { branch: "congress",  numericId: 123 }  (legacy, links pre-merge)
 *
 * Returns null for anything else.
 */
export function parseTradeId(id: string): { branch: Branch; numericId: number } | null {
  const prefixed = /^(cong|exec)-(\d+)$/.exec(id);
  if (prefixed) {
    return {
      branch: prefixed[1] === "cong" ? "congress" : "executive",
      numericId: Number(prefixed[2]),
    };
  }
  // Legacy bare number — assume congress (the only thing that existed pre-merge).
  if (/^\d+$/.test(id)) {
    return { branch: "congress", numericId: Number(id) };
  }
  return null;
}
