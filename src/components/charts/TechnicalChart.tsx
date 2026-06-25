"use client";

import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import type { BarPoint } from "@/components/charts/TickerPriceChart";
import { bollinger, sma } from "@/lib/ta/indicators";
import { getChartTheme } from "@/components/charts/chartTheme";

const toTime = (iso: string): UTCTimestamp =>
  (Date.parse(`${iso}T00:00:00Z`) / 1000) as UTCTimestamp;

function linePoints(bars: BarPoint[], values: (number | null)[]) {
  return bars
    .map((b, i) => ({ time: toTime(b.date), value: values[i] }))
    .filter((p): p is { time: UTCTimestamp; value: number } => p.value != null);
}

export function TechnicalChart({ bars }: { bars: BarPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const theme = getChartTheme(true);
    const bandColor = `${theme.loss}59`;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: theme.ink,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
      rightPriceScale: { borderColor: theme.grid },
      timeScale: { borderColor: theme.grid },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: theme.profit, downColor: theme.loss, borderVisible: false,
      wickUpColor: theme.profit, wickDownColor: theme.loss,
    });
    chartRef.current = chart;
    candleRef.current = candles;
    sma50Ref.current = chart.addSeries(LineSeries, { color: "#38bdf8", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    sma200Ref.current = chart.addSeries(LineSeries, { color: "#2a5a8c", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    bbUpperRef.current = chart.addSeries(LineSeries, { color: bandColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    bbLowerRef.current = chart.addSeries(LineSeries, { color: bandColor, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      sma50Ref.current = null;
      sma200Ref.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const candles = candleRef.current;
    if (!candles || bars.length === 0) return;

    candles.setData(
      bars.map((b) => ({ time: toTime(b.date), open: b.open, high: b.high, low: b.low, close: b.close })),
    );

    const closes = bars.map((b) => b.close);
    if (sma50Ref.current) sma50Ref.current.setData(linePoints(bars, sma(closes, 50)));
    if (sma200Ref.current) sma200Ref.current.setData(linePoints(bars, sma(closes, 200)));
    const bb = bollinger(closes, 20, 2);
    if (bbUpperRef.current) bbUpperRef.current.setData(linePoints(bars, bb.upper));
    if (bbLowerRef.current) bbLowerRef.current.setData(linePoints(bars, bb.lower));

    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  if (bars.length === 0) {
    return <div className="grid h-[360px] place-items-center text-sm text-muted-foreground">No price history.</div>;
  }
  return (
    <div
      className="relative h-[420px] w-full rounded-sm border border-zinc-700/70"
      style={{ background: "transparent" }}
    >
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
