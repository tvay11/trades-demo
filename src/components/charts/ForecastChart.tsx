"use client";

import {
  createChart,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { BarPoint } from "@/components/charts/TickerPriceChart";
import { buildForecastSeries } from "@/components/charts/forecastSeries";
import type { ForecastMeta, ForecastPoint } from "@/lib/queries/priceForecast";
import { getChartTheme } from "@/components/charts/chartTheme";

const HISTORY_TAIL = 60;

const toTime = (iso: string): UTCTimestamp =>
  (Date.parse(`${iso}T00:00:00Z`) / 1000) as UTCTimestamp;

export function ForecastChart({
  bars,
  forecast,
  meta,
  light = false,
}: {
  bars: BarPoint[];
  forecast: ForecastPoint[];
  meta: ForecastMeta;
  light?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const historyRef = useRef<ISeriesApi<"Line"> | null>(null);
  const medianRef = useRef<ISeriesApi<"Line"> | null>(null);
  const lowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  const upperRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const theme = getChartTheme(true);
    const bandColor = `${theme.accent}45`;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: theme.ink,
        fontFamily: theme.fontMono,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      rightPriceScale: { borderColor: theme.grid },
      timeScale: { borderColor: theme.grid, rightOffset: 6 },
    });

    historyRef.current = chart.addSeries(LineSeries, {
      color: theme.profit,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    upperRef.current = chart.addSeries(LineSeries, {
      color: bandColor,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    lowerRef.current = chart.addSeries(LineSeries, {
      color: bandColor,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    medianRef.current = chart.addSeries(LineSeries, {
      color: theme.accent,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    chartRef.current = chart;
    return () => {
      chart.remove();
      chartRef.current = null;
      historyRef.current = null;
      medianRef.current = null;
      lowerRef.current = null;
      upperRef.current = null;
    };
  }, [light]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !historyRef.current || !medianRef.current || !lowerRef.current || !upperRef.current) {
      return;
    }
    if (bars.length === 0) return;

    const tail = bars.slice(-HISTORY_TAIL);
    historyRef.current.setData(tail.map((b) => ({ time: toTime(b.date), value: b.close })));

    const last = tail[tail.length - 1];
    const series = buildForecastSeries({ date: last.date, close: last.close }, forecast);
    medianRef.current.setData(series.median);
    lowerRef.current.setData(series.lower);
    upperRef.current.setData(series.upper);

    chart.timeScale().fitContent();
  }, [bars, forecast]);

  if (bars.length === 0 || forecast.length === 0) {
    return (
      <div className="grid h-[360px] place-items-center text-sm text-muted-foreground">
        No forecast available — run the forecast notebook for this ticker.
      </div>
    );
  }

  const theme = getChartTheme();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: theme.accent }} />
          Median
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: `${theme.accent}45` }} />
          p10–p90 band
        </span>
        <span className="ml-auto normal-case">
          Forecast model · {meta.sampleCount} samples · {meta.horizonDays}d · generated {meta.generatedAt}
        </span>
      </div>
      <div
        className="relative h-[420px] w-full rounded-sm border border-zinc-700/70"
        style={{ background: "transparent" }}
      >
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
