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
  type Plugin,
  type ScriptableContext,
} from "chart.js";
import { Line } from "react-chartjs-2";

import type { BarPoint } from "@/components/charts/TickerPriceChart";
import type { ForecastPoint } from "@/lib/queries/priceForecast";
import { getChartTheme } from "@/components/charts/chartTheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

// Apply global defaults once at module load time
ChartJS.defaults.font.family = "'JetBrains Mono', monospace";
ChartJS.defaults.color = "#524a40";

// ── helpers ───────────────────────────────────────────────────────────────────
const HISTORY_TAIL = 62;

function mmdd(iso: string): string {
  return iso.slice(5, 10); // "YYYY-MM-DD" → "MM-DD"
}

// ── custom plugin: TODAY line + forecast endpoint dot/label ───────────────────
function makeLedgerForecastPlugin(
  todayIdx: number,
  inkColor: string,
  accentColor: string,
  paperColor: string,
): Plugin<"line"> {
  return {
    id: "ledgerForecastAnnotations",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea) return;

      // ── TODAY vertical dashed line ──────────────────────────────────────────
      const xToday = scales["x"].getPixelForValue(todayIdx);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = `${inkColor}73`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xToday, chartArea.top);
      ctx.lineTo(xToday, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // "TODAY ▾" label above the line
      ctx.fillStyle = inkColor;
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("TODAY ▾", xToday, chartArea.top + 14);
      ctx.restore();

      // ── Forecast endpoint dot + label ──────────────────────────────────────
      // Dataset index 3 = forecast median
      const metaMedian = chart.getDatasetMeta(3);
      if (!metaMedian || !metaMedian.data || metaMedian.data.length === 0) return;

      // Find the last non-null point in the median dataset
      const rawData = chart.data.datasets[3].data as (number | null)[];
      let lastValidLocalIdx = -1;
      for (let i = rawData.length - 1; i >= 0; i--) {
        if (rawData[i] != null) {
          lastValidLocalIdx = i;
          break;
        }
      }
      if (lastValidLocalIdx < 0) return;

      const point = metaMedian.data[lastValidLocalIdx];
      if (!point) return;

      const px = point.x;
      const py = point.y;
      const val = rawData[lastValidLocalIdx] as number;

      ctx.save();
      // Accent dot
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();
      ctx.strokeStyle = paperColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label "$xxx.xx ▼"
      const label = `$${val.toFixed(2)} ▼`;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = accentColor;
      ctx.textAlign = px > chartArea.right - 80 ? "right" : "center";
      ctx.fillText(label, px, py - 12);
      ctx.restore();
    },
  };
}

// ── component ─────────────────────────────────────────────────────────────────
export function LedgerForecastChart({
  bars,
  forecast,
}: {
  bars: BarPoint[];
  forecast: ForecastPoint[];
}) {
  const theme = getChartTheme();

  if (bars.length === 0) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: 420, fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: theme.muted }}>
        No price history.
      </div>
    );
  }

  // Take the last HISTORY_TAIL bars
  const histBars = bars.slice(-HISTORY_TAIL);
  const histDates = histBars.map((b) => mmdd(b.date));
  const forecastDates = forecast.map((p) => mmdd(p.date));
  const labels = [...histDates, ...forecastDates];

  const todayIdx = histBars.length - 1; // index of last actual bar

  // ── series data ──────────────────────────────────────────────────────────
  // Actual close: history values, then null for each forecast step
  const aC: (number | null)[] = [
    ...histBars.map((b) => b.close),
    ...forecast.map(() => null),
  ];

  // Forecast series: (histLength-1) nulls, then anchor close, then forecast points
  const histLen = histBars.length;
  const lastClose = histBars[histLen - 1]?.close ?? 0;

  const fC: (number | null)[] = [
    ...Array(histLen - 1).fill(null),
    lastClose,
    ...forecast.map((p) => p.close),
  ];
  const fH: (number | null)[] = [
    ...Array(histLen - 1).fill(null),
    lastClose,
    ...forecast.map((p) => p.upper),
  ];
  const fL: (number | null)[] = [
    ...Array(histLen - 1).fill(null),
    lastClose,
    ...forecast.map((p) => p.lower),
  ];

  // ── gradient factory (runs in afterInit / inside canvas context) ─────────
  // We define it as a scriptable backgroundColor on the actual line dataset.
  const profitRgb = theme.profit; // used in closures below
  const actualGradient = (ctx: ScriptableContext<"line">) => {
    const chart = ctx.chart;
    const { chartArea } = chart;
    if (!chartArea) return `${profitRgb}00`;
    const gradient = chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, `${profitRgb}24`);
    gradient.addColorStop(1, `${profitRgb}00`);
    return gradient;
  };

  const bandFill = `${theme.accent}1a`;

  const data = {
    labels,
    datasets: [
      // 1. Upper band (fill to +1 = lower band)
      {
        label: "_upper",
        data: fH,
        borderColor: "transparent" as const,
        pointRadius: 0,
        fill: "+1" as const,
        backgroundColor: bandFill,
        tension: 0,
        borderWidth: 0,
      },
      // 2. Lower band
      {
        label: "_lower",
        data: fL,
        borderColor: "transparent" as const,
        pointRadius: 0,
        fill: false as const,
        backgroundColor: "transparent",
        tension: 0,
        borderWidth: 0,
      },
      // 3. Actual close (profit color, gradient fill)
      {
        label: "Actual close",
        data: aC,
        borderColor: theme.profit,
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.25,
        fill: true,
        backgroundColor: actualGradient,
      },
      // 4. Forecast median (accent dashed)
      {
        label: "Forecast",
        data: fC,
        borderColor: theme.accent,
        borderWidth: 3,
        borderDash: [7, 5],
        pointRadius: 0,
        tension: 0.25,
        fill: false,
        backgroundColor: "transparent",
      },
    ],
  };

  const plugin = makeLedgerForecastPlugin(todayIdx, theme.ink, theme.accent, theme.paper);

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
            return idx % 6 === 0 ? labels[idx] : "";
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
    <div style={{ position: "relative", height: 420, width: "100%" }}>
      <Line data={data} options={options} plugins={[plugin]} />
    </div>
  );
}
