"use client";

import { StatCard } from "@/components/stat-card";
import type { IconName } from "@/components/stat-card";

type HeroStat = {
  label: string;
  value: number;
  iconName: IconName;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
};

export function DashboardHero({ stats }: { stats: HeroStat[] }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          <span className="text-sky-400">Capitol</span> Dashboard
        </h1>
        <p className="font-mono text-xs text-zinc-500">
          Track congressional stock trades, analyze patterns, and stay informed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            iconName={stat.iconName}
            change={stat.change}
            changeType={stat.changeType}
            delay={i * 80}
          />
        ))}
      </div>
    </section>
  );
}
