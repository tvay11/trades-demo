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
import type { DelayBucket } from "@/lib/queries/disclosureDelay";

export function DisclosureDelay({ data }: { data: DelayBucket[] }) {
  const total = data.reduce((acc, b) => acc + b.count, 0);
  if (total === 0) {
    return (
      <div className="grid h-72 place-items-center font-mono text-xs text-zinc-500">
        <div className="text-center">
          <div className="empty-orb mx-auto mb-3 size-16 rounded-sm border border-zinc-700/70" />
          No trades to histogram.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="delayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.42} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.14} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#18181b" strokeOpacity={0.72} vertical={false} />
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} allowDecimals={false} width={50} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: 4, boxShadow: "0 12px 34px rgba(0,0,0,0.45)", color: "#f4f4f5", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}
            formatter={(value) => [String(value), "Trades"]}
          />
          <Bar dataKey="count" name="Trades" fill="url(#delayGradient)" fillOpacity={0.85} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
