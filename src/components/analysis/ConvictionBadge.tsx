import type { ConvictionComponent } from "@/lib/analysis/convictionScore";

interface ConvictionBadgeProps {
  score: number | null;
  breakdown: ConvictionComponent[];
}

export function ConvictionBadge({ score, breakdown }: ConvictionBadgeProps) {
  if (score === null) {
    return (
      <span className="font-mono text-muted-foreground tabular-nums">—</span>
    );
  }

  const title = breakdown.map((c) => `${c.label} ${c.pts}/${c.max}`).join(" · ");
  const colorClass =
    score >= 70
      ? "text-profit"
      : score >= 45
        ? "text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <span
      className={`font-mono font-bold tabular-nums ${colorClass}`}
      title={title}
    >
      {score}
    </span>
  );
}
