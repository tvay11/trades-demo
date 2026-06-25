import Link from "next/link";
import { ConvictionBadge } from "@/components/analysis/ConvictionBadge";
import type { NewIdeas } from "@/lib/queries/morningBrief";

export function NewIdeasSection({ ideas }: { ideas: NewIdeas }) {
  const { longs, shorts } = ideas;
  if (longs.length === 0 && shorts.length === 0) return null;

  return (
    <section className="qq-panel overflow-hidden">
      <div className="qq-section-header">
        <div>
          <h2 className="qq-section-title">New Ideas</h2>
          <p className="qq-section-subtitle">long/short scanner + conviction</p>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-2">
        <IdeaColumn label="LONG" toneClass="text-profit border-profit/20 bg-profit/10" ideas={longs} />
        <IdeaColumn label="SHORT" toneClass="text-destructive border-destructive/20 bg-destructive/10" ideas={shorts} />
      </div>
    </section>
  );
}

function IdeaColumn({
  label,
  toneClass,
  ideas,
}: {
  label: string;
  toneClass: string;
  ideas: { ticker: string; score: number; conviction: import("@/lib/analysis/convictionRollup").TickerConviction | null }[];
}) {
  return (
    <div className="border-b border-border sm:border-b-0 sm:border-r sm:last:border-r-0">
      <div className="border-b border-border bg-muted px-4 py-2">
        <span
          className={`inline-flex rounded border px-1.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] ${toneClass}`}
        >
          {label}
        </span>
      </div>

      {ideas.length === 0 ? (
        <div className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
          No candidates
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {ideas.map((row) => (
            <div
              key={row.ticker}
              className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-muted/40"
            >
              <Link
                href={`/analysis/stocks/${row.ticker}`}
                className="font-mono text-xs font-bold text-primary transition hover:text-primary/80"
              >
                ${row.ticker}
              </Link>
              <div className="flex items-center gap-3">
                <span className="font-mono tabular-nums text-xs text-muted-foreground">
                  {row.score}
                </span>
                <ConvictionBadge
                  score={row.conviction?.score ?? null}
                  breakdown={row.conviction?.breakdown ?? []}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
