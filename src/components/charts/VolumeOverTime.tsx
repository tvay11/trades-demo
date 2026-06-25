"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VolumeBucket } from "@/lib/queries/volumeOverTime";

function formatDollar(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
}

export function VolumeOverTime({ data }: { data: VolumeBucket[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-64 place-items-center font-mono text-xs text-zinc-500">
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
            <linearGradient id="demGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="repGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#18181b" strokeOpacity={0.72} />
          <XAxis dataKey="week" tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", fill: "var(--muted-foreground)" }} tickFormatter={formatDollar} width={60} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => formatDollar(Number(value))}
            contentStyle={{
              backgroundColor: "#09090b",
              border: "1px solid #27272a",
              borderRadius: 4,
              boxShadow: "0 12px 34px rgba(0,0,0,0.45)",
              color: "#f4f4f5",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--muted-foreground)", fontFamily: "var(--font-geist-mono)", fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontFamily: "var(--font-geist-mono)", fontSize: 12 }} />
          <Line type="monotone" dataKey="dem" name="Democrat" stroke="#64748b" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="rep" name="Republican" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="ind" name="Other" stroke="#64748b" strokeWidth={2} dot={false} strokeDasharray="4 4" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
