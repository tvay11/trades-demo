import Link from "next/link";
import { Activity, ArrowUpRight, Binary, CandlestickChart, Database, Landmark, ListFilter, Network, Share2, ShieldAlert, Sparkles, Trophy, Users } from "lucide-react";
import { db } from "@/lib/db";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Analysis Workbench",
};

const analysisViews = [
  {
    href: "/analysis/congress-trades",
    title: "Congress Trade Screen",
    eyebrow: "Strictly data",
    body: "One factual row per ticker: trade counts, distinct politicians, party and chamber splits, committee-leadership activity, disclosed dollars, and filing lag. No scores.",
    icon: Users,
    tone: "primary",
  },
  {
    href: "/analysis/stocks",
    title: "Ticker Intelligence Lens",
    eyebrow: "Single stock",
    body: "Pick a ticker to drill into price overlays, politicians, data-source coverage, and timeline events.",
    icon: CandlestickChart,
    tone: "democrat",
  },
] as const;

export default async function AnalysisPage() {
  const dbCount = await db.congressTrade.count();
  const dbStatus = dbCount > 0 ? "Connected & Populated" : "Awaiting Data Sync";
  return (
    <main className="qq-page">
      <section className="qq-panel overflow-hidden p-4 sm:p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="qq-section-subtitle text-sky-500">Research terminal</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
              Analysis Workbench
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              SQL-backed factual screens for congressional flow, dark data, ticker drilldowns,
              and raw edge tables. Built around counts, percentages, dollars, and dates.
            </p>
          </div>
          <div className="qq-metric p-4">
            <div className="flex items-center gap-2 text-sky-400">
              <Activity className="size-4" />
              <span className="font-mono text-xs uppercase tracking-[0.18em]">
                Current priority
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Start with Data Health. Then use edge pages to inspect what the SQL rows actually
              say before interpreting anything.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {analysisViews.map((view) => {
          const Icon = view.icon;

          return (
            <Link
              key={view.href}
              href={view.href}
              className="qq-panel group min-h-[260px] overflow-hidden p-4 transition hover:border-primary/25 hover:bg-primary/[0.025]"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="grid size-10 place-items-center rounded-md border border-sky-900/40 bg-sky-950/20 text-sky-400"
                  >
                    <Icon className="size-5" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-sky-400" />
                </div>
                <div className="mt-5">
                  <div className="qq-section-subtitle">{view.eyebrow}</div>
                  <h2 className="mt-2 text-base font-semibold tracking-tight text-zinc-100">{view.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{view.body}</p>
                </div>
                <div className="mt-auto pt-6">
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-sky-400">
                    Open view
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="qq-panel p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sky-400">
              <Database className="size-4" />
              <span className="font-mono text-xs uppercase tracking-[0.16em]">Database Status</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className={`size-2 rounded-full ${dbCount > 0 ? "bg-profit" : "bg-destructive"} animate-pulse`} />
              <p className="text-sm font-medium text-foreground">
                {dbStatus} ({dbCount.toLocaleString()} records)
              </p>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              These analysis modules run exclusively on your live Turso SQL database. Make sure your daily sync is running to keep the data fresh.
            </p>
          </div>
          <Button nativeButton={false} variant="outline" render={<Link href="/datasets" />}>
            View tables
          </Button>
        </div>
      </section>
    </main>
  );
}
