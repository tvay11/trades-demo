import type { Ledger, StreetRead } from "@/lib/ledger/types";

interface SignalMiniStripsProps {
  report: Ledger | null;
}

function streetColor(read: StreetRead): string {
  if (read === "improving") return "text-profit";
  if (read === "deteriorating") return "text-destructive";
  return "text-amber-400";
}

function optionsColor(lean: string): string {
  if (lean === "bullish") return "text-profit";
  if (lean === "bearish") return "text-destructive";
  return "text-amber-400";
}

export function SignalMiniStrips({ report }: SignalMiniStripsProps) {
  if (!report) return null;

  const { streetMomentum, options, altFlow } = report;

  const hasStreet = !!streetMomentum;
  const hasOptions = !!options;
  const hasAltFlow = !!(altFlow?.wsb || (altFlow?.darkShort?.excessPp != null) || altFlow?.govContracts);

  if (!hasStreet && !hasOptions && !hasAltFlow) return null;

  return (
    <div className="qq-panel divide-y divide-border">
      {/* Street Momentum row */}
      {hasStreet && streetMomentum && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 font-mono text-sm">
          <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground" data-label="street">
            Street
          </span>
          <span className={`font-bold ${streetColor(streetMomentum.read)}`}>
            {streetMomentum.read.toUpperCase()}
          </span>
          {/* 0q revision counts */}
          {(() => {
            const zeroQ = streetMomentum.revisions?.find((r) => r.period === "0q");
            if (!zeroQ) return null;
            return (
              <span className="text-muted-foreground">
                ▲{zeroQ.up30}/▼{zeroQ.down30} Q ests
              </span>
            );
          })()}
          {/* Beat/miss count */}
          {(streetMomentum.surpriseTotal ?? 0) > 0 && (
            <span className="text-muted-foreground">
              beat {streetMomentum.beatCount}/{streetMomentum.surpriseTotal}
            </span>
          )}
          {/* PEAD chip */}
          {streetMomentum.pead?.active && (
            <span className="inline-flex items-center rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-amber-400">
              PEAD
            </span>
          )}
        </div>
      )}

      {/* Options row */}
      {hasOptions && options && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 font-mono text-sm">
          <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground" data-label="options">
            Options
          </span>
          <span className={`font-bold ${optionsColor(options.lean)}`}>
            {options.lean.toUpperCase()}
          </span>
          {options.putCallVolume != null && (
            <span className="text-muted-foreground">P/C {options.putCallVolume}</span>
          )}
          {options.expectedMovePct != null && (
            <span className="text-muted-foreground">±{options.expectedMovePct}% implied</span>
          )}
          {options.ivRankPct != null && (
            <span className="text-muted-foreground">IV rank {options.ivRankPct}%</span>
          )}
        </div>
      )}

      {/* Alt flow row */}
      {hasAltFlow && altFlow && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-2 font-mono text-sm">
          <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground" data-label="alt-flow">
            Alt flow
          </span>
          {altFlow.wsb && (
            <>
              <span className="text-muted-foreground">{altFlow.wsb.mentions7d} WSB 7d</span>
              {altFlow.wsb.crowded && (
                <span className="inline-flex items-center rounded border border-destructive/25 bg-destructive/10 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-destructive">
                  CROWDED
                </span>
              )}
            </>
          )}
          {altFlow.darkShort?.excessPp != null && (
            <span className="text-muted-foreground">
              dark short +{altFlow.darkShort.excessPp}pp
            </span>
          )}
          {altFlow.govContracts && (
            <span className="text-muted-foreground">
              {altFlow.govContracts.count180d} gov awards
            </span>
          )}
        </div>
      )}
    </div>
  );
}
