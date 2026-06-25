import { Badge } from "@/components/ui/badge";
import type { Party, TradeType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PartyBadge({ party }: { party: Party | null | undefined }) {
  // Renders nothing for null/undefined — executive officials don't always
  // have a party affiliation that lines up with congressional D/R.
  if (party !== "D" && party !== "R") return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "ledger-stamp h-5 px-1.5 font-mono text-[10px] font-medium",
        party === "D"
          ? "border-border bg-muted text-muted-foreground"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      [{party}]
    </Badge>
  );
}

export function TradeTypeBadge({ type }: { type: TradeType }) {
  const classes = {
    Buy: "border-profit/30 bg-profit/10 text-profit",
    Sell: "border-loss/30 bg-loss/10 text-loss",
    Exchange: "border-border bg-muted text-muted-foreground",
  }[type];

  return (
    <Badge
      variant="outline"
      className={cn("ledger-stamp h-5 px-2 font-mono text-[10px] font-bold", classes)}
    >
      {type}
    </Badge>
  );
}
