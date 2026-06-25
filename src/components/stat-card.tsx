"use client";

import { useCountUp } from "@/components/use-count-up";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Users,
  TrendingUp,
  Clock,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "bar-chart": BarChart3,
  users: Users,
  "trending-up": TrendingUp,
  clock: Clock,
};

export type IconName = keyof typeof ICON_MAP;

type StatCardProps = {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  iconName: IconName;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  delay?: number;
  format?: (n: number) => string;
};

function defaultFormat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function StatCard({
  label,
  value,
  prefix = "",
  suffix = "",
  iconName,
  change,
  changeType = "neutral",
  delay = 0,
  format = defaultFormat,
}: StatCardProps) {
  const { value: animatedValue, ref } = useCountUp(value, { duration: 1400 });
  const Icon = ICON_MAP[iconName] ?? BarChart3;

  return (
    <div
      data-testid="stat-card"
      className={cn(
        "ledger-callout group relative overflow-hidden p-4 transition-colors hover:border-zinc-500/80",
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="data-label">
            {label}
          </p>
          <p
            ref={ref as React.Ref<HTMLParagraphElement>}
            className="data-value text-2xl font-bold tracking-normal"
          >
            {prefix}
            {format(animatedValue)}
            {suffix}
          </p>
          {change && (
            <p
              className={cn(
                "font-mono text-xs font-medium",
                changeType === "positive" && "text-sky-500",
                changeType === "negative" && "text-rose-500",
                changeType === "neutral" && "text-muted-foreground"
              )}
            >
              {change}
            </p>
          )}
        </div>
        <div className="ledger-stamp flex size-9 items-center justify-center border-sky-900/40 bg-sky-950/20 text-sky-400">
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}
