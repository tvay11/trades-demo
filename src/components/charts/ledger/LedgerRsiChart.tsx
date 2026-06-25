"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type { BarPoint } from "@/components/charts/TickerPriceChart";
import { rsi } from "@/lib/ta/indicators";
import { getChartTheme } from "@/components/charts/chartTheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const TAIL = 90;

function mmdd(iso: string): string {
  return iso.slice(5, 10);
}

export function LedgerRsiChart({ bars }: { bars: BarPoint[] }) {
  const theme = getChartTheme();

  if (bars.length === 0) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: 200, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: theme.muted }}>
        No data.
      </div>
    );
  }

  const closes = bars.map((b) => b.close);
  const rsiVals = rsi(closes, 14);

  const startIdx = Math.max(0, bars.length - TAIL);
  const tail = bars.slice(startIdx);
  const labels = tail.map((b) => mmdd(b.date));
  const rsiTail = rsiVals.slice(startIdx) as (number | null)[];

  // Overbought / oversold guide lines (constant arrays)
  const guide70 = tail.map(() => 70);
  const guide30 = tail.map(() => 30);

  const data = {
    labels,
    datasets: [
      // 1. Overbought guide (70)
      {
        label: "_70",
        data: guide70,
        borderColor: `${theme.loss}66`,
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
      },
      // 2. Oversold guide (30)
      {
        label: "_30",
        data: guide30,
        borderColor: `${theme.profit}66`,
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
      },
      // 3. RSI line
      {
        label: "RSI (14)",
        data: rsiTail,
        borderColor: "#2a5a8c",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0.2,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.surface,
        titleColor: theme.ink,
        bodyColor: theme.muted,
        titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        callbacks: {
          label: (item) => {
            const v = item.raw as number | null;
            if (v == null || String(item.dataset.label).startsWith("_")) return "";
            return `RSI: ${v.toFixed(1)}`;
          },
        },
        filter: (item) => !String(item.dataset.label).startsWith("_"),
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: theme.muted,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          maxRotation: 0,
          callback: function (val, idx) {
            return idx % 15 === 0 ? labels[idx] : "";
          },
        },
        border: { display: false },
      },
      y: {
        min: 20,
        max: 80,
        grid: { color: theme.grid },
        ticks: {
          color: theme.muted,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          stepSize: 20,
        },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ position: "relative", height: 200, width: "100%" }}>
      <Line data={data} options={options} />
    </div>
  );
}
