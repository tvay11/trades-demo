import { cn } from "@/lib/utils";
import type { Branch } from "@/lib/trades/unified";

const LABELS: Record<Branch, string> = {
  congress: "Cong",
  executive: "Exec",
};

const CLASSES: Record<Branch, string> = {
  congress: "border-border bg-muted text-muted-foreground",
  executive: "border-border bg-muted text-muted-foreground",
};

export function TradeBranchBadge({
  branch,
  className,
}: {
  branch: Branch;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "ledger-stamp inline-flex items-center px-1.5 py-0.5 font-mono text-[0.6rem] tracking-[0.12em]",
        CLASSES[branch],
        className,
      )}
      title={
        branch === "congress"
          ? "Congressional disclosure"
          : "Executive-branch disclosure"
      }
    >
      {LABELS[branch]}
    </span>
  );
}
