"use client";

import { Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

// Small "Data through {date}" chip for analysis page heros. Color escalates
// with staleness so the user sees the risk at a glance:
//   - 0–2d: muted (fresh)
//   - 3–6d: cyan (warming)
//   - 7d+:  red (stale, may not reflect current market)
// Null `date` renders a neutral "no data" chip rather than nothing so the
// affordance is consistent across pages.

export function FreshnessChip({
  date,
  label = "Data through",
}: {
  /** Latest data date as YYYY-MM-DD, Date, or null. */
  date: string | Date | null | undefined;
  /** Prefix label. Override per page if "Data through" doesn't fit. */
  label?: string;
}) {
  const parsed = useMemo(
    () =>
      date instanceof Date
        ? date
        : typeof date === "string"
          ? new Date(`${date.slice(0, 10)}T00:00:00Z`)
          : null,
    [date],
  );
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Client-only timestamp. Keeping it out of render avoids Next prerender current-time errors.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);

  if (!parsed || Number.isNaN(parsed.getTime())) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted-foreground">
        <Clock className="size-3" />
        No data
      </span>
    );
  }

  const daysOld = now == null ? null : Math.floor((now - parsed.getTime()) / 86_400_000);
  const tone =
    daysOld == null
      ? "fresh"
      : daysOld >= 7
      ? "stale"
      : daysOld >= 3
        ? "warming"
        : "fresh";
  const display = parsed.toISOString().slice(0, 10);
  const suffix =
    daysOld == null ? null : daysOld <= 0 ? "today" : daysOld === 1 ? "yesterday" : `${daysOld}d ago`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[0.66rem] uppercase tracking-[0.14em]",
        tone === "stale" && "border-loss/30 bg-loss/10 text-loss",
        tone === "warming" && "border-sky-500/25 bg-sky-500/10 text-sky-300",
        tone === "fresh" && "border-border bg-muted text-muted-foreground",
      )}
      title={`Latest source row dated ${display}`}
    >
      <Clock className="size-3" />
      {label} {display}
      {suffix ? ` · ${suffix}` : null}
    </span>
  );
}
