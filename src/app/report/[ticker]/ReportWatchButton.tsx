import { addToWatchlist, removeFromWatchlist } from "@/app/watchlist/actions";

/** Watchlist toggle styled to match the report utility-bar buttons (Remake / Export). */
export function ReportWatchButton({
  ticker,
  watched,
  onDark = true,
}: {
  ticker: string;
  watched: boolean;
  onDark?: boolean;
}) {
  const fg = onDark ? "var(--background)" : "var(--foreground)";
  const inverse = onDark ? "var(--foreground)" : "var(--background)";

  const btn: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: "10.5px",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    color: watched ? inverse : fg,
    background: watched ? fg : "transparent",
    border: `1px solid ${fg}`,
    padding: "3px 10px",
    cursor: "pointer",
  };

  return (
    <form action={watched ? removeFromWatchlist : addToWatchlist} style={{ display: "inline-flex" }}>
      <input type="hidden" name="ticker" value={ticker} />
      <button
        type="submit"
        style={btn}
        title={watched ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
      >
        {watched ? "Watching" : "Watch"}
      </button>
    </form>
  );
}
