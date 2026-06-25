import { BarChart3 } from "lucide-react";
import type { EdgarFundamentals, EdgarPeriod } from "@/lib/ledger/types";

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toLocaleString("en-US")}`;
}

function fmtPct(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}

function signedPct(n: number | null): string {
  return n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function yoyClass(n: number | null): string {
  if (n == null) return "text-muted-foreground";
  return n >= 0 ? "text-profit" : "text-destructive";
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="data-label">{label}</div>
      <div className={`mt-0.5 font-mono tabular-nums text-sm font-semibold ${className ?? ""}`}>{value}</div>
    </div>
  );
}

function PeriodColumn({ period }: { period: EdgarPeriod }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{period.fiscalLabel}</span>
        <span className="data-label">
          {period.form}
          {period.periodEnd ? ` · ${period.periodEnd}` : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Stat label="Revenue" value={fmtMoney(period.revenue)} />
        <Stat label="Rev YoY" value={signedPct(period.revenueYoYPct)} className={yoyClass(period.revenueYoYPct)} />
        <Stat label="Gross margin" value={fmtPct(period.grossMarginPct)} />
        <Stat label="Net income" value={fmtMoney(period.netIncome)} />
        <Stat label="Net YoY" value={signedPct(period.netIncomeYoYPct)} className={yoyClass(period.netIncomeYoYPct)} />
        <Stat
          label="Diluted EPS"
          value={period.dilutedEps == null ? "—" : `$${period.dilutedEps.toFixed(2)}`}
        />
      </div>
    </div>
  );
}

export function FundamentalsCard({ fundamentals }: { fundamentals: EdgarFundamentals | null }) {
  if (!fundamentals || (!fundamentals.annual && !fundamentals.quarter)) return null;

  return (
    <section className="qq-panel overflow-hidden">
      <div className="qq-section-header">
        <div>
          <h2 className="qq-section-title">Company Fundamentals</h2>
          <p className="qq-section-subtitle">SEC EDGAR · latest 10-K and 10-Q</p>
        </div>
        <BarChart3 className="size-4 text-primary" />
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {fundamentals.annual && <PeriodColumn period={fundamentals.annual} />}
        {fundamentals.quarter && <PeriodColumn period={fundamentals.quarter} />}
      </div>
    </section>
  );
}
