import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;
type MockChartOptions = {
  layout: {
    background: { color: string };
    textColor: string;
  };
};
type MockSeries = {
  type: string;
  options: Record<string, unknown>;
  setData: MockFn;
  priceScale: MockFn;
  createPriceLine: MockFn;
  removePriceLine: MockFn;
};
type MockChart = {
  options: MockChartOptions;
  series: MockSeries[];
  addSeries: MockFn;
  priceScale: MockFn;
  timeScale: MockFn;
  subscribeCrosshairMove: MockFn;
  unsubscribeCrosshairMove: MockFn;
  remove: MockFn;
};
type MockMarkerApi = {
  series: MockSeries;
  markers: unknown[];
  setMarkers: MockFn;
};

const chartState = vi.hoisted(() => ({
  resolvedTheme: "dark",
  charts: [] as MockChart[],
  markerApis: [] as MockMarkerApi[],
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: chartState.resolvedTheme }),
}));

vi.mock("lightweight-charts", () => {
  const makeSeries = (type: string, options: Record<string, unknown>) => {
    const series: MockSeries = {
      type,
      options,
      setData: vi.fn(),
      priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
      createPriceLine: vi.fn((priceLineOptions: Record<string, unknown>) => ({ priceLineOptions })),
      removePriceLine: vi.fn(),
    };
    return series;
  };

  return {
    CandlestickSeries: "CandlestickSeries",
    HistogramSeries: "HistogramSeries",
    LineSeries: "LineSeries",
    LineStyle: { Dotted: 1, Dashed: 2 },
    createChart: vi.fn((_container: HTMLElement, options: MockChartOptions) => {
      const chart: MockChart = {
        options,
        series: [],
        addSeries: vi.fn((type: string, seriesOptions: Record<string, unknown>) => {
          const series = makeSeries(type, seriesOptions);
          chart.series.push(series);
          return series;
        }),
        priceScale: vi.fn(() => ({ applyOptions: vi.fn() })),
        timeScale: vi.fn(() => ({
          setVisibleRange: vi.fn(),
          fitContent: vi.fn(),
        })),
        subscribeCrosshairMove: vi.fn(),
        unsubscribeCrosshairMove: vi.fn(),
        remove: vi.fn(),
      };
      chartState.charts.push(chart);
      return chart;
    }),
    createSeriesMarkers: vi.fn((series: MockSeries, markers: unknown[]) => {
      const markerApi: MockMarkerApi = {
        series,
        markers,
        setMarkers: vi.fn(),
      };
      chartState.markerApis.push(markerApi);
      return markerApi;
    }),
  };
});

import {
  TickerPriceChart,
  type BarPoint,
  type TradeOverlay,
} from "./TickerPriceChart";

const bars: BarPoint[] = [
  { date: "2026-01-02", open: 100, high: 105, low: 99, close: 104, volume: 1_000_000 },
  { date: "2026-01-03", open: 104, high: 106, low: 101, close: 102, volume: 850_000 },
];

const trades: TradeOverlay[] = [
  {
    date: "2026-01-02",
    disclosureDate: "2026-01-08",
    type: "buy",
    transactionType: "Purchase",
    minimum: 75_000,
    amountRangeRaw: "$50,001 - $100,000",
    politicianName: "Jane Doe",
    party: "D",
    ticker: "NVDA",
    close: 104,
  },
];

function setCssVars(vars: Record<string, string>) {
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
}

describe("TickerPriceChart theme behavior", () => {
  beforeEach(() => {
    chartState.resolvedTheme = "dark";
    chartState.charts.length = 0;
    chartState.markerApis.length = 0;
    document.documentElement.removeAttribute("style");
    document.documentElement.className = "dark";
    setCssVars({
      "--background": "#09090b",
      "--foreground": "#f4f4f5",
      "--chart-grid": "rgba(24,24,27,0.42)",
      "--muted-foreground": "#a1a1aa",
      "--primary": "#38bdf8",
      "--profit": "#38bdf8",
      "--loss": "#f43f5e",
    });
  });

  it("rebuilds the chart with light CSS variables when the app theme changes", async () => {
    const { rerender } = render(
      <TickerPriceChart bars={bars} trades={trades} ticker="NVDA" />,
    );

    await waitFor(() => expect(chartState.charts).toHaveLength(1));
    expect(chartState.charts[0].options.layout.background.color).toBe("#09090b");
    expect(chartState.charts[0].series[0].options.upColor).toBe("#38bdf8");

    chartState.resolvedTheme = "light";
    document.documentElement.className = "light";
    setCssVars({
      "--background": "#f7f3e9",
      "--foreground": "#1a1714",
      "--chart-grid": "rgb(95 87 77 / 0.22)",
      "--muted-foreground": "#5f574d",
      "--primary": "#0369a1",
      "--profit": "#0369a1",
      "--loss": "#e11d48",
    });

    rerender(<TickerPriceChart bars={bars} trades={trades} ticker="NVDA" />);

    await waitFor(() => expect(chartState.charts).toHaveLength(2));
    expect(chartState.charts[0].remove).toHaveBeenCalledOnce();
    expect(chartState.charts[1].options.layout.background.color).toBe("#f7f3e9");
    expect(chartState.charts[1].options.layout.textColor).toBe("#1a1714");
    expect(chartState.charts[1].series[0].options.upColor).toBe("#0369a1");

    await waitFor(() => expect(chartState.markerApis[1].setMarkers).toHaveBeenCalled());
    expect(chartState.markerApis[1].setMarkers.mock.calls.at(-1)?.[0][0].color).toBe("#0369a1");
  });
});
