import { ChartCard } from "@/components/charts/Card";
import { Skeleton } from "@/components/ui/skeleton";

export default function InsightsLoading() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <h1 className="text-2xl font-semibold">Insights</h1>

      <ChartCard
        title="Sector heatmap (last 90 days)"
        description="Boxes sized by minimum disclosed dollars traded. Hover for amounts."
      >
        <Skeleton className="h-80 w-full" />
      </ChartCard>

      <ChartCard
        title="Buy/sell sentiment (last 12 months)"
        description="Per week: total buy $ minus total sell $. Above zero = net buying, below = net selling."
      >
        <Skeleton className="h-72 w-full" />
      </ChartCard>

      <ChartCard
        title="Disclosure delay"
        description="Days between when a trade happened and when it was disclosed (all-time, all trades)."
      >
        <Skeleton className="h-72 w-full" />
      </ChartCard>
    </main>
  );
}
