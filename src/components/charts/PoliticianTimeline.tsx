"use client";

import {
  CartesianGrid,
  Legend,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ResponsiveContainer } from "recharts";

export type TimelineTrade = {
  date: string; // ISO yyyy-mm-dd
  minimum: number;
  ticker: string;
  type: string;
};

function classify(type: string): "buy" | "sell" | "other" {
  const t = type.toLowerCase();
  if (t.includes("purchase")) return "buy";
  if (t.includes("sale")) return "sell";
  return "other";
}

function formatDollar(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

export function PoliticianTimeline({ trades }: { trades: TimelineTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="grid h-72 place-items-center font-mono text-xs text-zinc-500">
        <div className="text-center">
          <div className="empty-orb mx-auto mb-3 size-16 rounded-sm border border-zinc-700/70" />
          No trades to plot.
        </div>
      </div>
    );
  }

  const buys = trades.filter((t) => classify(t.type) === "buy");
  const sells = trades.filter((t) => classify(t.type) === "sell");
  const others = trades.filter((t) => classify(t.type) === "other");

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#18181b" strokeOpacity={0.72} />
          <XAxis dataKey="date" type="category" tick={{ fontSize: 10, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} allowDuplicatedCategory={false} axisLine={false} tickLine={false} />
          <YAxis dataKey="minimum" type="number" tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} tickFormatter={formatDollar} width={70} axisLine={false} tickLine={false} />
          <ZAxis range={[40, 200]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: 4, boxShadow: "0 12px 34px rgba(0,0,0,0.45)", color: "#f4f4f5", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}
            formatter={(value, name) => {
              if (name === "minimum") return [formatDollar(Number(value)), "Amount"];
              return [String(value), String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontFamily: "var(--font-geist-mono)", fontSize: 12 }} />
          <Scatter name="Buy" data={buys} fill="#38bdf8" />
          <Scatter name="Sell" data={sells} fill="#f43f5e" />
          <Scatter name="Other" data={others} fill="#64748b" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
