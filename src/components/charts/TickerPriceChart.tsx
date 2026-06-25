"use client";

import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  applyMarkerFilters,
  DEFAULT_FILTERS,
  MIN_DOLLAR_OPTIONS,
  type MarkerFilterState,
} from "./markerFilters";
import { getChartTheme } from "./chartTheme";

export type BarPoint = {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TradeOverlay = {
  date: string;
  disclosureDate: string;
  type: "buy" | "sell" | "other";
  transactionType: string;
  minimum: number;
  amountRangeRaw: string | null;
  politicianName: string;
  party: string | null;
  ticker: string;
  close: number | null;
};

type RangeKey = "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";
type ChartThemeKey = "light" | "dark";
const RANGES: { key: RangeKey; days: number | null }[] = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "YTD", days: -1 },
  { key: "1Y", days: 365 },
  { key: "5Y", days: 365 * 5 },
  { key: "ALL", days: null },
];

// Static palette constants (theme-independent hues for MA overlays;
// main palette is resolved at runtime via getChartTheme()).
const COLOR = {
  ma50: "#38bdf8",
  ma200: "#2a5a8c",
} as const;

const toTime = (iso: string): UTCTimestamp =>
  (Date.parse(`${iso}T00:00:00Z`) / 1000) as UTCTimestamp;

function sma(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

function rangeStartTime(bars: BarPoint[], range: RangeKey): UTCTimestamp | null {
  if (bars.length === 0) return null;
  const lastIso = bars[bars.length - 1].date;
  const lastMs = Date.parse(`${lastIso}T00:00:00Z`);
  const entry = RANGES.find((r) => r.key === range);
  if (!entry) return null;
  if (entry.days === null) return toTime(bars[0].date);
  if (range === "YTD") {
    const year = new Date(lastMs).getUTCFullYear();
    return (Date.parse(`${year}-01-01T00:00:00Z`) / 1000) as UTCTimestamp;
  }
  return ((lastMs - entry.days * 86_400_000) / 1000) as UTCTimestamp;
}

function fmtDollar(n: number) {
  return `$${n.toFixed(2)}`;
}
function fmtVolume(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

function readDocumentTheme(): ChartThemeKey | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function TickerPriceChart({
  bars,
  trades,
  ticker,
}: {
  bars: BarPoint[];
  trades: TradeOverlay[];
  ticker: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ma50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const refLinesRef = useRef<IPriceLine[]>([]);

  const [range, setRange] = useState<RangeKey>("1Y");
  const [showMA50, setShowMA50] = useState(false);
  const [showMA200, setShowMA200] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [filters, setFilters] = useState<MarkerFilterState>(DEFAULT_FILTERS);
  const { resolvedTheme } = useTheme();
  const [documentTheme, setDocumentTheme] = useState<ChartThemeKey | null>(null);
  const chartThemeKey: ChartThemeKey =
    documentTheme ?? (resolvedTheme === "light" ? "light" : "dark");

  const [hover, setHover] = useState<{
    bar: BarPoint | null;
    trades: TradeOverlay[];
  } | null>(null);

  const tradesByDate = useMemo(() => {
    const map = new Map<string, TradeOverlay[]>();
    for (const t of trades) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return map;
  }, [trades]);

  // Keep latest data accessible from the long-lived crosshair handler.
  const dataRef = useRef({ bars, tradesByDate });
  useEffect(() => {
    dataRef.current = { bars, tradesByDate };
  }, [bars, tradesByDate]);

  useEffect(() => {
    const syncDocumentTheme = () => setDocumentTheme(readDocumentTheme());
    syncDocumentTheme();

    const observer = new MutationObserver(syncDocumentTheme);
    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  // Mount chart once.
  useEffect(() => {
    if (!containerRef.current) return;
    const theme = getChartTheme(true);
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { color: theme.paper },
        textColor: theme.ink,
        fontFamily: theme.fontMono,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      rightPriceScale: { borderColor: theme.grid },
      timeScale: { borderColor: theme.grid, rightOffset: 4 },
      crosshair: {
        mode: 1,
        vertLine: { color: theme.muted, style: LineStyle.Dotted },
        horzLine: { color: theme.muted, style: LineStyle.Dotted },
      },
    });

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: theme.profit,
      downColor: theme.loss,
      borderVisible: false,
      wickUpColor: theme.profit,
      wickDownColor: theme.loss,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart
      .priceScale("vol")
      .applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.25 } });

    chartRef.current = chart;
    candleSeriesRef.current = candles;
    volumeSeriesRef.current = volume;
    markersRef.current = createSeriesMarkers(candles, []);

    const onCrosshair = (param: { time?: Time }) => {
      if (!param.time) {
        setHover(null);
        return;
      }
      const ts = param.time as UTCTimestamp;
      const iso = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
      const { bars: latestBars, tradesByDate: latestMap } = dataRef.current;
      const bar = latestBars.find((b) => b.date === iso) ?? null;
      setHover({ bar, trades: latestMap.get(iso) ?? [] });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ma50SeriesRef.current = null;
      ma200SeriesRef.current = null;
      markersRef.current = null;
      refLinesRef.current = [];
    };
  }, [chartThemeKey]);

  // Push bar + volume + reference price lines when bars change.
  useEffect(() => {
    const cs = candleSeriesRef.current;
    const vs = volumeSeriesRef.current;
    if (!cs || !vs) return;

    const theme = getChartTheme(true);
    cs.setData(
      bars.map((b) => ({
        time: toTime(b.date),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      })),
    );
    vs.setData(
      bars.map((b) => ({
        time: toTime(b.date),
        value: b.volume,
        color: b.close >= b.open
          ? `${theme.profit}73`
          : `${theme.loss}73`,
      })),
    );

    for (const line of refLinesRef.current) cs.removePriceLine(line);
    refLinesRef.current = [];
    if (bars.length > 0) {
      const last = bars[bars.length - 1];
      const lastYearMs = Date.parse(`${last.date}T00:00:00Z`) - 365 * 86_400_000;
      const window = bars.filter(
        (b) => Date.parse(`${b.date}T00:00:00Z`) >= lastYearMs,
      );
      const hi = window.reduce((m, b) => (b.high > m ? b.high : m), -Infinity);
      const lo = window.reduce((m, b) => (b.low < m ? b.low : m), Infinity);
      if (Number.isFinite(hi)) {
        refLinesRef.current.push(
          cs.createPriceLine({
            price: hi,
            color: theme.muted,
            lineStyle: LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: "52w hi",
          }),
        );
      }
      if (Number.isFinite(lo)) {
        refLinesRef.current.push(
          cs.createPriceLine({
            price: lo,
            color: theme.muted,
            lineStyle: LineStyle.Dashed,
            lineWidth: 1,
            axisLabelVisible: true,
            title: "52w lo",
          }),
        );
      }
      refLinesRef.current.push(
        cs.createPriceLine({
          price: last.close,
          color: theme.accent,
          lineStyle: LineStyle.Dotted,
          lineWidth: 1,
          axisLabelVisible: true,
          title: "last",
        }),
      );
    }
  }, [bars, chartThemeKey]);

  // MA toggles.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const closes = bars.map((b) => b.close);

    if (showMA50) {
      if (!ma50SeriesRef.current) {
        ma50SeriesRef.current = chart.addSeries(LineSeries, {
          color: COLOR.ma50,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      const arr = sma(closes, 50);
      ma50SeriesRef.current.setData(
        bars
          .map((b, i) => ({ time: toTime(b.date), value: arr[i] }))
          .filter(
            (p): p is { time: UTCTimestamp; value: number } => p.value !== null,
          ),
      );
    } else if (ma50SeriesRef.current) {
      chart.removeSeries(ma50SeriesRef.current);
      ma50SeriesRef.current = null;
    }

    if (showMA200) {
      if (!ma200SeriesRef.current) {
        ma200SeriesRef.current = chart.addSeries(LineSeries, {
          color: COLOR.ma200,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      }
      const arr = sma(closes, 200);
      ma200SeriesRef.current.setData(
        bars
          .map((b, i) => ({ time: toTime(b.date), value: arr[i] }))
          .filter(
            (p): p is { time: UTCTimestamp; value: number } => p.value !== null,
          ),
      );
    } else if (ma200SeriesRef.current) {
      chart.removeSeries(ma200SeriesRef.current);
      ma200SeriesRef.current = null;
    }
  }, [showMA50, showMA200, bars, chartThemeKey]);

  // Range — visible logical range.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || bars.length === 0) return;
    const start = rangeStartTime(bars, range);
    const end = toTime(bars[bars.length - 1].date);
    if (start != null) {
      chart.timeScale().setVisibleRange({ from: start, to: end });
    } else {
      chart.timeScale().fitContent();
    }
  }, [range, bars, chartThemeKey]);

  // Log scale.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale("right").applyOptions({ mode: logScale ? 1 : 0 });
  }, [logScale, chartThemeKey]);

  // Markers — re-push when trades or filters change.
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;
    const theme = getChartTheme(true);
    const visible = applyMarkerFilters(trades, filters);
    const data: SeriesMarker<Time>[] = visible
      .map((t) => ({
        time: toTime(t.date),
        position:
          t.type === "buy"
            ? ("belowBar" as const)
            : t.type === "sell"
              ? ("aboveBar" as const)
              : ("inBar" as const),
        color:
          t.type === "buy"
            ? theme.profit
            : t.type === "sell"
              ? theme.loss
              : theme.muted,
        shape:
          t.type === "buy"
            ? ("arrowUp" as const)
            : t.type === "sell"
              ? ("arrowDown" as const)
              : ("circle" as const),
        text:
          t.minimum >= 50_000
            ? `$${Math.round(t.minimum / 1000)}k`
            : undefined,
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));
    markers.setMarkers(data);
  }, [trades, filters, chartThemeKey]);

  const counts = useMemo(() => {
    // Count across the entire trade set rather than the post-filter visible
    // set. Otherwise toggling "Buy" off makes the "Buy(0)" chip read as
    // "no buy trades exist" when the truth is "buy trades are hidden".
    return {
      buy: trades.filter((t) => t.type === "buy").length,
      sell: trades.filter((t) => t.type === "sell").length,
      other: trades.filter((t) => t.type === "other").length,
      total: trades.length,
    };
  }, [trades]);

  if (bars.length === 0) {
    return (
      <div className="grid h-[420px] place-items-center text-sm text-muted-foreground">
        <div className="text-center">
          <div className="empty-orb mx-auto mb-3 size-16 rounded-sm" />
          Price history unavailable for this ticker.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-base font-semibold text-primary">
            ${ticker}
          </span>
          <div className="ledger-filter-strip">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded px-2 py-1 font-mono text-[0.68rem] uppercase tracking-wider transition",
                  range === r.key
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {r.key}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolbarToggle label="MA50" on={showMA50} onChange={setShowMA50} dot={COLOR.ma50} />
          <ToolbarToggle label="MA200" on={showMA200} onChange={setShowMA200} dot={COLOR.ma200} />
          <ToolbarToggle label="LOG" on={logScale} onChange={setLogScale} />
        </div>
      </div>

      <div className="relative h-[560px] w-full rounded-sm border border-border bg-card">
        <div ref={containerRef} className="absolute inset-0" />
        <CrosshairLegend hover={hover} fallbackBar={bars[bars.length - 1]} />
      </div>

      <div className="ledger-filter-strip flex flex-wrap gap-2 px-2 py-1.5 text-[0.68rem]">
        <FilterToggle
          label={`Buy(${counts.buy})`}
          on={filters.showBuy}
          onChange={(v) => setFilters((f) => ({ ...f, showBuy: v }))}
          tone="profit"
        />
        <FilterToggle
          label={`Sell(${counts.sell})`}
          on={filters.showSell}
          onChange={(v) => setFilters((f) => ({ ...f, showSell: v }))}
          tone="loss"
        />
        <FilterToggle
          label={`Other(${counts.other})`}
          on={filters.showOther}
          onChange={(v) => setFilters((f) => ({ ...f, showOther: v }))}
        />
        <div className="mx-2 h-4 w-px bg-border" />
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Min $</span>
          <select
            value={filters.minDollar}
            onChange={(e) =>
              setFilters((f) => ({ ...f, minDollar: Number(e.target.value) }))
            }
            className="rounded border border-border bg-card px-2 py-0.5 text-foreground"
          >
            {MIN_DOLLAR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="mx-2 h-4 w-px bg-border" />
        <span className="text-muted-foreground">Party</span>
        <FilterToggle
          label="D"
          on={filters.showD}
          onChange={(v) => setFilters((f) => ({ ...f, showD: v }))}
          tone="dem"
        />
        <FilterToggle
          label="R"
          on={filters.showR}
          onChange={(v) => setFilters((f) => ({ ...f, showR: v }))}
          tone="rep"
        />
        <FilterToggle
          label="I"
          on={filters.showI}
          onChange={(v) => setFilters((f) => ({ ...f, showI: v }))}
        />
        <button
          type="button"
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="ml-auto rounded border border-border px-2 py-0.5 text-muted-foreground transition hover:text-foreground"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function CrosshairLegend({
  hover,
  fallbackBar,
}: {
  hover: { bar: BarPoint | null; trades: TradeOverlay[] } | null;
  fallbackBar: BarPoint;
}) {
  const bar = hover?.bar ?? fallbackBar;
  const tradesHere = hover?.trades ?? [];
  const changePct = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
  const changeColor = bar.close >= bar.open ? "text-profit" : "text-loss";
  return (
    <div className="ledger-menu pointer-events-none absolute left-3 top-3 z-10 px-3 py-2 font-mono text-[0.72rem]">
      <div className="flex items-baseline gap-2 text-muted-foreground">
        <span>{bar.date}</span>
        <span className={changeColor}>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-foreground">
        <span>O {fmtDollar(bar.open)}</span>
        <span>H {fmtDollar(bar.high)}</span>
        <span>L {fmtDollar(bar.low)}</span>
        <span>C {fmtDollar(bar.close)}</span>
        <span className="text-muted-foreground">Vol {fmtVolume(bar.volume)}</span>
      </div>
      {tradesHere.length > 0 ? (
        <div className="mt-1 border-t border-border pt-1 text-[0.66rem] text-muted-foreground">
          {tradesHere.length} congress trade
          {tradesHere.length === 1 ? "" : "s"}:{" "}
          {tradesHere
            .slice(0, 3)
            .map((t) => `${t.politicianName} (${t.type})`)
            .join(", ")}
          {tradesHere.length > 3 ? ` +${tradesHere.length - 3} more` : ""}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarToggle({
  label,
  on,
  onChange,
  dot,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        "ledger-stamp flex items-center gap-1.5 px-2 py-1 text-[0.68rem] transition-colors",
        on
          ? "border-border bg-muted/50 text-foreground"
          : "border-border bg-transparent text-muted-foreground hover:bg-muted/40",
      )}
    >
      {dot ? (
        <span
          className="inline-block size-2 rounded-full"
          style={{
            background: on ? dot : "transparent",
            border: `1px solid ${dot}`,
          }}
        />
      ) : null}
      {label}
    </button>
  );
}

function FilterToggle({
  label,
  on,
  onChange,
  tone,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  tone?: "profit" | "loss" | "dem" | "rep";
}) {
  const onClass =
    tone === "profit"
      ? "border-profit/40 bg-profit/15 text-profit"
      : tone === "loss"
        ? "border-loss/40 bg-loss/15 text-loss"
        : tone === "dem"
          ? "border-[#2f5fae]/40 bg-[#2f5fae]/15 text-[#2f5fae]"
          : tone === "rep"
            ? "border-[#b23b3b]/40 bg-[#b23b3b]/15 text-[#b23b3b]"
            : "border-border bg-muted/40 text-foreground";
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn(
        "rounded border px-2 py-0.5 transition",
        on
          ? onClass
          : "border-border bg-transparent text-muted-foreground/60 hover:text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
