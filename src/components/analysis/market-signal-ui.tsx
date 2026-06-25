import { AlertTriangle, ArrowUpRight, Database } from "lucide-react";
import Link from "next/link";

import type { MarketSignalMetric } from "@/lib/queries/marketSignalData";
import { cn } from "@/lib/utils";

export function SignalMetricGrid({ metrics }: { metrics: MarketSignalMetric[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="qq-metric min-w-0 p-3">
          <div className="data-label">{metric.label}</div>
          <div
            className={cn(
              "mt-1 truncate font-mono text-lg font-semibold",
              metric.tone === "positive" && "text-profit",
              metric.tone === "negative" && "text-loss",
              metric.tone === "accent" && "text-primary",
            )}
          >
            {metric.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SignalPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "negative" | "accent";
}) {
  return (
    <span
      className={cn(
        "ledger-stamp inline-flex items-center px-2 py-1 font-mono text-[0.68rem] tracking-[0.12em]",
        tone === "positive" && "border-profit/30 bg-profit/10 text-profit",
        tone === "negative" && "border-loss/30 bg-loss/10 text-loss",
        tone === "accent" && "border-profit/30 bg-profit/10 text-profit",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function FactStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative" | "accent";
}) {
  return (
    <div className="qq-metric px-2.5 py-2">
      <div className="data-label">{label}</div>
      <div
        className={cn(
          "mt-1 truncate font-mono text-sm font-semibold",
          tone === "positive" && "text-profit",
          tone === "negative" && "text-loss",
          tone === "accent" && "text-primary",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function SignalPanelHeader({
  title,
  subtitle,
  source,
}: {
  title: string;
  subtitle: string;
  source?: "database" | "database-error";
}) {
  return (
    <div className="qq-section-header">
      <div>
        <h2 className="qq-section-title">{title}</h2>
        <p className="qq-section-subtitle">{subtitle}</p>
      </div>
      {source ? (
        <SignalPill tone={source === "database-error" ? "negative" : "accent"}>
          <Database className="mr-1 size-3" />
          {source === "database-error" ? "SQL error" : "SQL"}
        </SignalPill>
      ) : null}
    </div>
  );
}

export function ReasonList({
  reasons,
  warnings,
}: {
  reasons: string[];
  warnings: string[];
}) {
  return (
    <div className="space-y-1.5">
      {reasons.slice(0, 3).map((reason) => (
        <div key={reason} className="flex items-start gap-2 text-xs text-muted-foreground">
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
          <span>{reason}</span>
        </div>
      ))}
      {warnings.slice(0, 2).map((warning) => (
        <div key={warning} className="flex items-start gap-2 text-xs text-loss/90">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}

export function TickerLink({
  ticker,
  companyName,
}: {
  ticker: string;
  companyName: string | null;
}) {
  return (
    <Link
      href={`/analysis/stocks/${ticker}`}
      className="group inline-flex min-w-0 items-center gap-2 transition hover:text-primary/80"
    >
      <span className="font-mono text-xs font-bold text-primary">${ticker}</span>
      <span className="truncate text-muted-foreground group-hover:text-foreground">
        {companyName ?? "Unknown issuer"}
      </span>
      <ArrowUpRight className="size-3 shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

export function EmptySignal({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid place-items-center px-6 py-12 text-center">
      <div className="empty-orb mb-4 size-16 rounded-sm border border-border" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function formatSignedMoney(value: number) {
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function formatCompactNumber(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

export function dateText(date: Date | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function stanceTone(value: string): "neutral" | "positive" | "negative" | "accent" {
  if (value.includes("Long")) return "positive";
  if (value.includes("Short")) return "negative";
  return "neutral";
}
