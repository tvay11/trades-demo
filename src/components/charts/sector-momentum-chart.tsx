"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis, Tooltip } from "recharts";
import { formatMoney } from "@/lib/format";
import { useRouter } from "next/navigation";

type SectorMomentumRow = {
  sector: string;
  buyVolume: number;
  sellVolume: number;
  netVolume: number;
};

type SectorMomentumChartRow = SectorMomentumRow & {
  fill: string;
  shortSector: string;
};

export function SectorMomentumChart({
  data,
}: {
  data: SectorMomentumRow[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      setChartWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  if (data.length === 0) {
    return (
      <div className="ledger-empty h-64">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          No momentum data
        </span>
      </div>
    );
  }

  // Add fill color dynamically based on positive/negative
  const chartData: SectorMomentumChartRow[] = data.map((item) => ({
    ...item,
    fill: item.netVolume >= 0 ? "#38bdf8" : "#f43f5e",
    shortSector: item.sector.length > 12 ? item.sector.substring(0, 12) + "..." : item.sector,
  }));

  return (
    <div ref={containerRef} className="h-[250px] min-h-[250px] w-full min-w-0">
      {chartWidth > 0 ? (
        <BarChart
          accessibilityLayer
          data={chartData}
          width={chartWidth}
          height={250}
          margin={{
            top: 10,
            right: 10,
            left: 30,
            bottom: 0,
          }}
          barSize={32}
        >
        <CartesianGrid vertical={false} stroke="#18181b" strokeOpacity={0.72} />
        <XAxis
          dataKey="shortSector"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value) => formatMoney(value)}
          tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--color-muted-foreground)" }}
        />
        <Tooltip
          cursor={{ fill: "rgba(24,24,27,0.55)" }}
          content={({ active, payload }) => {
            const datum = getTooltipDatum(payload);
            if (!active || !datum) return null;
            return (
              <div className="ledger-menu px-3 py-2 font-mono text-xs">
                <div className="font-medium text-zinc-100">{datum.sector}</div>
                <div className="mt-1 text-[0.7rem] uppercase tracking-widest text-zinc-500">
                  Net Capital Flow
                </div>
                <div className={`mt-1 font-mono font-semibold ${datum.netVolume >= 0 ? "text-profit" : "text-loss"}`}>
                  {datum.netVolume >= 0 ? "+" : ""}{formatMoney(datum.netVolume)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 border-t border-zinc-700/70 pt-2 text-[0.75rem]">
                  <span className="text-zinc-500">Buys: <span className="text-profit">{formatMoney(datum.buyVolume)}</span></span>
                  <span className="text-zinc-500">Sells: <span className="text-loss">{formatMoney(datum.sellVolume)}</span></span>
                </div>
              </div>
            );
          }}
        />
        <Bar
          dataKey="netVolume"
          radius={[4, 4, 0, 0]}
          cursor="pointer"
          onClick={(payload: unknown) => {
            const sector = getClickedSector(payload);
            if (sector) {
              router.push(`/datasets/stocks?f_sector=${encodeURIComponent(sector)}`);
            }
          }}
        >
          {/* Per-bar fill must be applied via Cell children — passing fill on
              <Bar> overrides the computed `fill` field on each datum, so every
              bar (including negatives) was rendered as the positive color. */}
          {chartData.map((d) => (
            <Cell key={d.sector} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
      ) : (
        <div className="ledger-empty h-full">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Measuring chart
          </span>
        </div>
      )}
    </div>
  );
}

function getTooltipDatum(payload: unknown): SectorMomentumChartRow | null {
  if (!Array.isArray(payload)) return null;
  const first = payload[0];
  if (!isRecord(first) || !isSectorMomentumChartRow(first.payload)) return null;
  return first.payload;
}

function getClickedSector(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.sector === "string") return payload.sector;
  const nested = payload.payload;
  if (isRecord(nested) && typeof nested.sector === "string") return nested.sector;
  return null;
}

function isSectorMomentumChartRow(value: unknown): value is SectorMomentumChartRow {
  return (
    isRecord(value) &&
    typeof value.sector === "string" &&
    typeof value.buyVolume === "number" &&
    typeof value.sellVolume === "number" &&
    typeof value.netVolume === "number" &&
    typeof value.fill === "string" &&
    typeof value.shortSector === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
