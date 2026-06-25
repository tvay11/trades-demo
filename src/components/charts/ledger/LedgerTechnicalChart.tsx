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
import { bollinger, sma } from "@/lib/ta/indicators";
import { getChartTheme } from "@/components/charts/chartTheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const TAIL = 90;

function mmdd(iso: string): string {
  return iso.slice(5, 10);
}

export function LedgerTechnicalChart({ bars }: { bars: BarPoint[] }) {
  const theme = getChartTheme();

  if (bars.length === 0) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: 380, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: theme.muted }}>
        No price history.
      </div>
    );
  }

  const closes = bars.map((b) => b.close);

  // Compute on full history for warmup, then slice last TAIL
  const bb = bollinger(closes, 20, 2);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);

  const tail = bars.slice(-TAIL);
  const startIdx = bars.length - TAIL;

  const labels = tail.map((b) => mmdd(b.date));
  const slice = <T,>(arr: T[]) => arr.slice(startIdx < 0 ? 0 : startIdx);

  const closeTail = slice(closes) as number[];
  const bbUpperTail = slice(bb.upper) as (number | null)[];
  const bbLowerTail = slice(bb.lower) as (number | null)[];
  const bbMiddleTail = slice(bb.middle) as (number | null)[];
  const sma50Tail = slice(sma50) as (number | null)[];
  const sma200Tail = slice(sma200) as (number | null)[];

  const bbBorder = `${theme.loss}59`;
  const bbFill = `${theme.loss}12`;
  const bbMid = `${theme.loss}80`;

  const data = {
    labels,
    datasets: [
      // 1. Bollinger upper (fill to +1 = lower)
      {
        label: "_bb_upper",
        data: bbUpperTail,
        borderColor: bbBorder,
        borderWidth: 1,
        pointRadius: 0,
        fill: "+1" as const,
        backgroundColor: bbFill,
        tension: 0,
      },
      // 2. Bollinger lower
      {
        label: "_bb_lower",
        data: bbLowerTail,
        borderColor: bbBorder,
        borderWidth: 1,
        pointRadius: 0,
        fill: false as const,
        backgroundColor: "transparent",
        tension: 0,
      },
      // 3. Bollinger middle (dashed)
      {
        label: "BB(20,2) mid",
        data: bbMiddleTail,
        borderColor: bbMid,
        borderWidth: 1,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
      },
      // 4. SMA 50
      {
        label: "SMA 50",
        data: sma50Tail,
        borderColor: "#b07a16",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
      },
      // 5. SMA 200
      {
        label: "SMA 200",
        data: sma200Tail,
        borderColor: "#2a5a8c",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0,
      },
      // 6. Close price
      {
        label: "Close",
        data: closeTail,
        borderColor: theme.ink,
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        backgroundColor: "transparent",
        tension: 0.15,
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
            if (v == null) return "";
            return `${item.dataset.label}: $${v.toFixed(2)}`;
          },
        },
        filter: (item) => !String(item.dataset.label).startsWith("_"),
      },
    },
    scales: {
      x: {
        grid: { color: theme.grid },
        ticks: {
          color: theme.muted,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          maxRotation: 0,
          callback: function (val, idx) {
            return idx % 9 === 0 ? labels[idx] : "";
          },
        },
        border: { display: false },
      },
      y: {
        grid: { color: theme.grid },
        ticks: {
          color: theme.muted,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          callback: (v) => `$${v}`,
        },
        border: { display: false },
      },
    },
  };

  return (
    <div style={{ position: "relative", height: 380, width: "100%" }}>
      <Line data={data} options={options} />
    </div>
  );
}
