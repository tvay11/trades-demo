"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SentimentBucket } from "@/lib/queries/buySellSentiment";

function formatDollar(v: number) {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1000)}k`;
  return `${sign}$${abs}`;
}

export function BuySellSentiment({ data }: { data: SentimentBucket[] }) {
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
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="sentimentGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#18181b" strokeOpacity={0.72} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} tickFormatter={formatDollar} width={70} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: 4, boxShadow: "0 12px 34px rgba(0,0,0,0.45)", color: "#f4f4f5", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}
            formatter={(value) => [formatDollar(Number(value)), "Net (buy - sell)"]}
          />
          <ReferenceLine y={0} stroke="#3f3f46" strokeOpacity={0.7} />
          <Line type="monotone" dataKey="sentiment" stroke="url(#sentimentGrad)" strokeWidth={2.5} dot={false} isAnimationActive={true} animationDuration={1000} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
