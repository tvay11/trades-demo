export type ChartTheme = {
  ink: string;
  paper: string;
  surface: string;
  grid: string;
  muted: string;
  accent: string;
  profit: string;
  loss: string;
  dem: string;
  rep: string;
  fontBody: string;
  fontMono: string;
};

function cssVar(name: string, fallback: string, resolve: boolean): string {
  if (!resolve || typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function getChartTheme(resolve = false): ChartTheme {
  return {
    ink: cssVar("--foreground", "#f4f4f5", resolve),
    paper: cssVar("--background", "#09090b", resolve),
    surface: cssVar("--card", "rgb(9 9 11 / 0.55)", resolve),
    grid: cssVar("--chart-grid", "rgba(24,24,27,0.42)", resolve),
    muted: cssVar("--muted-foreground", "#a1a1aa", resolve),
    accent: cssVar("--primary", "#38bdf8", resolve),
    profit: cssVar("--profit", "#38bdf8", resolve),
    loss: cssVar("--loss", "#f43f5e", resolve),
    dem: "#64748b",
    rep: "#71717a",
    fontBody: "var(--font-geist), ui-sans-serif, system-ui, sans-serif",
    fontMono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  };
}
