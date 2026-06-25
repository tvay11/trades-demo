import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pages,
  onPageChange,
  className,
}: {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const numbers = Array.from({ length: pages }, (_, index) => index + 1).filter(
    (candidate) =>
      candidate === 1 ||
      candidate === pages ||
      Math.abs(candidate - page) <= 1,
  );

  return (
    <nav
      className={cn("flex items-center justify-end gap-1", className)}
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>
      {numbers.map((candidate, index) => {
        const previous = numbers[index - 1];
        const showGap = previous && candidate - previous > 1;

        return (
          <span key={candidate} className="flex items-center gap-1">
            {showGap ? (
              <span className="px-1 font-mono text-xs text-muted-foreground">...</span>
            ) : null}
            <Button
              variant={candidate === page ? "default" : "ghost"}
              size="sm"
              className="min-w-7 px-2 font-mono"
              onClick={() => onPageChange(candidate)}
              aria-current={candidate === page ? "page" : undefined}
            >
              {candidate}
            </Button>
          </span>
        );
      })}
      <Button
        variant="outline"
        size="icon-sm"
        disabled={page >= pages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
