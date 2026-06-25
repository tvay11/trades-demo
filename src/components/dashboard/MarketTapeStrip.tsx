import type { TapeCell } from "@/lib/queries/marketTape";
import type { MacroRegime } from "@/lib/ledger/types";

function formatPrice(price: number): string {
  if (price < 10) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function macroChipClass(label: MacroRegime["label"]): string {
  if (label === "risk-on")
    return "rounded border border-profit/25 bg-profit/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-profit";
  if (label === "risk-off")
    return "rounded border border-destructive/25 bg-destructive/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-destructive";
  // neutral
  return "rounded border border-border bg-muted px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground";
}

export function MarketTapeStrip({
  cells,
  macro,
}: {
  cells: TapeCell[];
  macro: MacroRegime | null;
}) {
  if (cells.length === 0 && macro === null) return null;

  return (
    <section className="qq-panel px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {cells.map((cell) => (
          <div key={cell.symbol} className="flex items-baseline gap-1.5">
            <span className="data-label uppercase" style={{ fontSize: "0.65rem" }}>
              {cell.label}
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatPrice(cell.price)}
            </span>
            {cell.changePct !== null && (
              <span
                className={[
                  "change-pct font-mono text-[0.7rem] tabular-nums",
                  cell.changePct > 0
                    ? "text-profit"
                    : cell.changePct < 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                ].join(" ")}
              >
                {cell.changePct > 0 ? "+" : ""}
                {cell.changePct.toFixed(2)}%
              </span>
            )}
          </div>
        ))}

        {macro !== null && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="data-label" style={{ fontSize: "0.65rem" }}>
              Macro
            </span>
            <span className={macroChipClass(macro.label)}>
              {macro.label}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
