"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { PieSlice } from "@/lib/queries/politicianBreakdown";

const COLORS = [
  "#38bdf8",
  "#64748b",
  "#a78bfa",
  "#f43f5e",
  "#f59e0b",
  "#64748b",
  "#ec4899",
  "#71717a",
  "#0f172a",
];

function formatDollar(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

export function TickerBreakdown({ data }: { data: PieSlice[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center font-mono text-xs text-zinc-500">
        <div className="text-center">
          <div className="empty-orb mx-auto mb-3 size-16 rounded-sm border border-zinc-700/70" />
          No trades to break down.
        </div>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatDollar(Number(value)), String(name)]}
            contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: 4, boxShadow: "0 12px 34px rgba(0,0,0,0.45)", color: "#f4f4f5", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontFamily: "var(--font-geist-mono)", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
