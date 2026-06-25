"use client";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

type PartyDonutData = Array<{ name: string; party: "D" | "R"; value: number }>;
type TopStocksData = Array<{
  ticker: string;
  companyName: string;
  volume: number;
  trades: number;
}>;
type TradeVolumeData = Array<{
  month: string;
  volume: number;
  trades: number;
  democrat: number;
  republican: number;
}>;

export function DashboardChartFallback({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div
      data-testid="dashboard-chart-fallback"
      className={cn(
        "grid place-items-center rounded border border-border bg-muted/20 px-4 text-center font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {label}
    </div>
  );
}

const LazyPartyDonutChart = dynamic(
  () => import("./terminal-charts").then((module) => module.PartyDonutChart),
  {
    ssr: false,
    loading: () => (
      <DashboardChartFallback label="Party breakdown" className="h-[228px]" />
    ),
  },
);

const LazyTopStocksBarChart = dynamic(
  () => import("./terminal-charts").then((module) => module.TopStocksBarChart),
  {
    ssr: false,
    loading: () => (
      <DashboardChartFallback label="Top stocks traded" className="h-[280px]" />
    ),
  },
);

const LazyTradeVolumeChart = dynamic(
  () => import("./terminal-charts").then((module) => module.TradeVolumeChart),
  {
    ssr: false,
    loading: () => (
      <DashboardChartFallback
        label="Monthly disclosure volume"
        className="h-[280px]"
      />
    ),
  },
);

export function DashboardPartyDonutChart({ data }: { data: PartyDonutData }) {
  return <LazyPartyDonutChart data={data} />;
}

export function DashboardTopStocksBarChart({ data }: { data: TopStocksData }) {
  return <LazyTopStocksBarChart data={data} />;
}

export function DashboardTradeVolumeChart({ data }: { data: TradeVolumeData }) {
  return <LazyTradeVolumeChart data={data} />;
}
