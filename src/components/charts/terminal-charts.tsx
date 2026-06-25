"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/format";
import { getChartTheme } from "@/components/charts/chartTheme";

function TooltipFrame({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="ledger-menu px-3 py-2 font-mono text-xs">
      {label ? <div className="mb-1 text-zinc-500">{label}</div> : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-3">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-zinc-400">{entry.name}</span>
            <span className="ml-auto text-zinc-100">
              {entry.value && entry.value > 1000
                ? formatMoney(entry.value)
                : entry.value?.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TradeVolumeChart({
  data,
}: {
  data: Array<{
    month: string;
    volume: number;
    trades: number;
    democrat: number;
    republican: number;
  }>;
}) {
  const theme = getChartTheme();
  const axis = {
    stroke: theme.muted,
    fontSize: 10,
    fontFamily: "var(--font-geist-mono)",
  };
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={theme.accent} stopOpacity={0.15} />
            <stop offset="100%" stopColor={theme.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#18181b" strokeOpacity={0.72} vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis
          tick={axis}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatMoney(Number(value))}
          width={64}
        />
        <Tooltip content={<TooltipFrame />} cursor={{ stroke: "#3f3f46", opacity: 0.35 }} />
        <Area
          type="monotone"
          dataKey="volume"
          name="Volume"
          stroke={theme.accent}
          strokeWidth={2}
          fill="url(#volumeFill)"
          fillOpacity={0.15}
          activeDot={{ r: 4, fill: theme.accent, stroke: "#09090b", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PartyDonutChart({
  data,
}: {
  data: Array<{ name: string; party: "D" | "R"; value: number }>;
}) {
  const theme = getChartTheme();
  return (
    <ResponsiveContainer width="100%" height={228}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={58}
          outerRadius={92}
          paddingAngle={4}
          stroke={theme.paper}
          strokeWidth={3}
        >
          {data.map((entry) => (
            <Cell
              key={entry.party}
              fill={entry.party === "D" ? theme.dem : theme.rep}
            />
          ))}
        </Pie>
        <Tooltip content={<TooltipFrame />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopStocksBarChart({
  data,
}: {
  data: Array<{ ticker: string; companyName: string; volume: number; trades: number }>;
}) {
  const theme = getChartTheme();
  const axis = {
    stroke: theme.muted,
    fontSize: 10,
    fontFamily: "var(--font-geist-mono)",
  };
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 10, top: 4, bottom: 4 }}
      >
        <CartesianGrid stroke="#18181b" strokeOpacity={0.72} horizontal={false} />
        <XAxis
          type="number"
          tick={axis}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatMoney(Number(value))}
        />
        <YAxis
          dataKey="ticker"
          type="category"
          tick={axis}
          axisLine={false}
          tickLine={false}
          width={54}
        />
        <Tooltip content={<TooltipFrame />} cursor={{ fill: "rgba(24,24,27,0.55)" }} />
        <Bar dataKey="volume" name="Volume" radius={[0, 5, 5, 0]} fill={theme.accent} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SectorDistributionChart({
  data,
}: {
  data: Array<{ sector: string; value: number; trades: number }>;
}) {
  const theme = getChartTheme();
  const axis = {
    stroke: theme.muted,
    fontSize: 10,
    fontFamily: "var(--font-geist-mono)",
  };
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data.slice(0, 7)} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
        <CartesianGrid stroke="#18181b" strokeOpacity={0.72} vertical={false} />
        <XAxis
          dataKey="sector"
          tick={axis}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-18}
          textAnchor="end"
          height={62}
        />
        <YAxis
          tick={axis}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatMoney(Number(value))}
          width={62}
        />
        <Tooltip content={<TooltipFrame />} cursor={{ fill: "rgba(24,24,27,0.55)" }} />
        <Bar dataKey="value" name="Volume" radius={[5, 5, 0, 0]} fill={theme.dem} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({
  data,
  color,
}: {
  data: Array<{ date?: string; month?: string; value?: number; trades?: number }>;
  color?: string;
}) {
  const theme = getChartTheme();
  const strokeColor = color ?? theme.accent;
  return (
    <ResponsiveContainer width="100%" height={52}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={data[0]?.value == null ? "trades" : "value"}
          stroke={strokeColor}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PortfolioAreaChart({
  data,
}: {
  data: Array<{ month: string; value: number }>;
}) {
  const theme = getChartTheme();
  const axis = {
    stroke: theme.muted,
    fontSize: 10,
    fontFamily: "var(--font-geist-mono)",
  };
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: 0, right: 10, top: 16, bottom: 0 }}>
        <defs>
          <linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={theme.profit} stopOpacity={0.15} />
            <stop offset="100%" stopColor={theme.profit} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#18181b" strokeOpacity={0.72} vertical={false} />
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis
          tick={axis}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value) => formatMoney(Number(value))}
          width={66}
        />
        <Tooltip content={<TooltipFrame />} cursor={{ stroke: theme.profit, opacity: 0.28 }} />
        <Area
          type="monotone"
          dataKey="value"
          name="Portfolio"
          stroke={theme.profit}
          strokeWidth={2}
          fill="url(#portfolioFill)"
          fillOpacity={0.15}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
