"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Chart } from "react-chartjs-2";

import type { BarPoint } from "@/components/charts/TickerPriceChart";
import { sma } from "@/lib/ta/indicators";
import { getChartTheme } from "@/components/charts/chartTheme";
import { formatVolume } from "@/lib/format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip);

const TAIL = 90;

function mmdd(iso: string): string {
  return iso.slice(5, 10);
}

export function LedgerVolumeChart({ bars }: { bars: BarPoint[] }) {
  const theme = getChartTheme();

  if (bars.length === 0) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: 200, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: theme.muted }}>
        No data.
      </div>
    );
  }

  const volumes = bars.map((b) => b.volume);
  const closes = bars.map((b) => b.close);
  const avg = sma(volumes, 20);

  const startIdx = Math.max(0, bars.length - TAIL);
  const tail = bars.slice(startIdx);
  const labels = tail.map((b) => mmdd(b.date));
  const volTail = volumes.slice(startIdx);
  const avgTail = avg.slice(startIdx);

  // Per-bar color: up day (close >= prior close) green, down day red.
  const colors = tail.map((b, i) => {
    const g = startIdx + i;
    const prev = g > 0 ? closes[g - 1] : b.close;
    return b.close >= prev ? `${theme.profit}8c` : `${theme.loss}8c`;
  });

  const data: ChartData<"bar" | "line"> = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Volume",
        data: volTail,
        backgroundColor: colors,
        barPercentage: 1,
        categoryPercentage: 1,
        order: 2,
      },
      {
        type: "line" as const,
        label: "Avg (20d)",
        data: avgTail,
        borderColor: "#b07a16",
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
        order: 1,
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
          label: (item) => `${item.dataset.label}: ${formatVolume(item.raw as number | null)}`,
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
          callback: (v) => formatVolume(v as number),
        },
        border: { display: false },
        beginAtZero: true,
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
