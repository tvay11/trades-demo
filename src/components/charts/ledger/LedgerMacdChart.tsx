"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Chart } from "react-chartjs-2";

import type { BarPoint } from "@/components/charts/TickerPriceChart";
import { macd } from "@/lib/ta/indicators";
import { getChartTheme } from "@/components/charts/chartTheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip);

const TAIL = 90;

function mmdd(iso: string): string {
  return iso.slice(5, 10);
}

export function LedgerMacdChart({ bars }: { bars: BarPoint[] }) {
  const theme = getChartTheme();

  if (bars.length === 0) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: 200, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: theme.muted }}>
        No data.
      </div>
    );
  }

  const closes = bars.map((b) => b.close);
  const { macd: macdLine, signal: signalLine, histogram } = macd(closes, 12, 26, 9);

  const startIdx = Math.max(0, bars.length - TAIL);
  const tail = bars.slice(startIdx);
  const labels = tail.map((b) => mmdd(b.date));

  const macdTail = macdLine.slice(startIdx);
  const signalTail = signalLine.slice(startIdx);
  const histTail = histogram.slice(startIdx);

  // Per-bar colors for the histogram
  const histColors = histTail.map((v) =>
    v >= 0 ? `${theme.profit}8c` : `${theme.loss}8c`,
  );

  const data: ChartData<"bar" | "line"> = {
    labels,
    datasets: [
      // 1. Histogram bars
      {
        type: "bar" as const,
        label: "Histogram",
        data: histTail,
        backgroundColor: histColors,
        barPercentage: 1,
        categoryPercentage: 1,
        order: 3,
      },
      // 2. MACD line
      {
        type: "line" as const,
        label: "MACD",
        data: macdTail,
        borderColor: theme.ink,
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
        order: 1,
      },
      // 3. Signal line (dashed amber)
      {
        type: "line" as const,
        label: "Signal",
        data: signalTail,
        borderColor: "#b07a16",
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
        order: 2,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
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
            const v = item.raw as number;
            return `${item.dataset.label}: ${v.toFixed(4)}`;
          },
        },
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
        grid: { color: theme.grid },
        ticks: {
          color: theme.muted,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
        },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ position: "relative", height: 200, width: "100%" }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Chart type="bar" data={data as any} options={options as any} />
    </div>
  );
}
