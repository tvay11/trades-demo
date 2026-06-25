import { RegenerateNoteButton } from "./RegenerateNoteButton";
import type { MorningNoteResult } from "@/lib/brief/generateMorningNote";

// Sentiment tint classes for headline tags
const sentimentClass: Record<"bullish" | "bearish" | "neutral", string> = {
  bullish: "border-profit/25 bg-profit/10 text-profit",
  bearish: "border-destructive/25 bg-destructive/10 text-destructive",
  neutral: "border-border bg-card text-muted-foreground",
};

/** Server component — renders the AI morning note with headline, note body, watch items, and headline tags. */
export function MorningNoteSection({
  result,
}: {
  result: MorningNoteResult | null;
}) {
  // Empty state: show a compact panel with a Generate button
  if (!result) {
    return (
      <section className="qq-panel p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs text-muted-foreground">No morning note yet &mdash; generate one to get today&apos;s AI market brief.</p>
          <RegenerateNoteButton label="Generate" />
        </div>
      </section>
    );
  }

  const { note, generatedAt } = result;
  const genDate = new Date(generatedAt);
  const timeLabel = genDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="qq-panel p-4">
      {/* Header row: headline + regenerate button */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold leading-snug text-foreground">
          {note.headline}
        </h2>
        <div className="shrink-0">
          <RegenerateNoteButton label="Regenerate" />
        </div>
      </div>

      {/* Note body */}
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {note.note}
      </p>

      {/* Watch items */}
      {note.watchItems.length > 0 && (
        <ul className="mt-3 space-y-1">
          {note.watchItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground">
              <span className="mt-0.5 shrink-0 text-primary">⚑</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Headline tags */}
      {note.headlineTags.length > 0 && (
        <div className="mt-4">
          <div className="data-label mb-2">Headlines</div>
          <div className="flex flex-wrap gap-2">
            {note.headlineTags.map((tag, i) => {
              const cls = [
                "inline-flex rounded border px-2 py-1 font-mono text-[0.65rem] leading-tight transition",
                sentimentClass[tag.sentiment],
              ].join(" ");
              if (tag.url && tag.url.startsWith("http")) {
                return (
                  <a
                    key={i}
                    href={tag.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cls + " hover:opacity-80"}
                  >
                    {tag.title}
                  </a>
                );
              }
              return (
                <span key={i} className={cls}>
                  {tag.title}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="mt-3 font-mono text-[0.65rem] text-muted-foreground">
        Generated at {timeLabel}
      </div>
    </section>
  );
}
