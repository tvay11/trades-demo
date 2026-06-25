"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TopTickerRow } from "@/lib/queries/topTickers";

function formatDollar(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

function Chart({ data }: { data: TopTickerRow[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center font-mono text-xs text-zinc-500">
        <div className="text-center">
          <div className="empty-orb mx-auto mb-3 size-16 rounded-sm border border-zinc-700/70" />
          No trades in this window.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.16} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#18181b" strokeOpacity={0.72} vertical={false} />
          <XAxis dataKey="ticker" tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} interval={0} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} tickFormatter={formatDollar} width={60} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value, _name, item) => {
              if (item?.dataKey === "total") return [formatDollar(Number(value)), "Total"];
              return [String(value), "Trades"];
            }}
            contentStyle={{
              backgroundColor: "#09090b",
              border: "1px solid #27272a",
              borderRadius: 4,
              boxShadow: "0 12px 34px rgba(0,0,0,0.45)",
              color: "#f4f4f5",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="total" name="Total" fill="url(#barGradient)" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type TopTickersData = {
  d30: TopTickerRow[];
  d90: TopTickerRow[];
  d365: TopTickerRow[];
};

export function TopTickers({ data }: { data: TopTickersData }) {
  return (
    <Tabs defaultValue="90">
      <TabsList className="mb-2">
        <TabsTrigger value="30">30d</TabsTrigger>
        <TabsTrigger value="90">90d</TabsTrigger>
        <TabsTrigger value="365">1y</TabsTrigger>
      </TabsList>
      <TabsContent value="30">
        <Chart data={data.d30} />
      </TabsContent>
      <TabsContent value="90">
        <Chart data={data.d90} />
      </TabsContent>
      <TabsContent value="365">
        <Chart data={data.d365} />
      </TabsContent>
    </Tabs>
  );
}
