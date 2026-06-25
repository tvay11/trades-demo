"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import type { SectorRow } from "@/lib/queries/sectorBreakdown";

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

type TreemapDatum = SectorRow & { fill: string };

export function SectorHeatmap({ data }: { data: SectorRow[] }) {
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

  const colored: TreemapDatum[] = data.map((d, i) => ({
    ...d,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={colored}
          dataKey="value"
          nameKey="sector"
          stroke="#09090b"
          isAnimationActive={true}
          animationDuration={800}
        >
          <Tooltip
            contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: 4, boxShadow: "0 12px 34px rgba(0,0,0,0.45)", color: "#f4f4f5", fontFamily: "var(--font-geist-mono)", fontSize: 12 }}
            formatter={(value, _name, item) => {
              const sector = (item?.payload as TreemapDatum | undefined)?.sector ?? "";
              return [formatDollar(Number(value)), sector];
            }}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
