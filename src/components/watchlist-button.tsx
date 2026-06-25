import { Star } from "lucide-react";

import { addToWatchlist, removeFromWatchlist } from "@/app/watchlist/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WatchlistButton({
  ticker,
  watched,
  compact = false,
  className,
}: {
  ticker: string;
  watched: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <form action={watched ? removeFromWatchlist : addToWatchlist} className={cn("inline-flex", className)}>
      <input type="hidden" name="ticker" value={ticker} />
      <Button
        type="submit"
        variant={watched ? "secondary" : "outline"}
        size={compact ? "icon-sm" : "sm"}
        title={watched ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
        aria-label={watched ? `Remove ${ticker} from watchlist` : `Add ${ticker} to watchlist`}
      >
        <Star className={cn("size-4", watched && "fill-primary text-primary")} />
        {compact ? null : watched ? "Watching" : "Watch"}
      </Button>
    </form>
  );
}
