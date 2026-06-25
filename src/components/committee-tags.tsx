import { Gavel } from "lucide-react";

import { shortCommitteeName, type CommitteeTag } from "@/lib/committees/queries";
import { cn } from "@/lib/utils";

export function CommitteeTags({
  committees,
  fallback = [],
  limit = 8,
}: {
  committees: CommitteeTag[];
  fallback?: string[];
  limit?: number;
}) {
  const rows = committees.length
    ? committees.slice(0, limit).map((committee) => ({
        key: committee.code,
        label: shortCommitteeName(committee.name),
        role: committee.role,
        isLeadership: committee.isChair || committee.isRanking,
      }))
    : fallback.slice(0, limit).map((committee) => ({
        key: committee,
        label: committee,
        role: null,
        isLeadership: false,
      }));

  if (!rows.length) {
    return (
      <span className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1 font-mono text-xs text-zinc-500">
        Committees not synced
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((committee) => (
        <span
          key={committee.key}
          className={cn(
            "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs",
            committee.isLeadership
              ? "border-sky-900/40 bg-sky-950/20 text-sky-400"
              : "border-zinc-800 bg-zinc-950/40 text-zinc-400",
          )}
          title={committee.role ? `${committee.label} · ${committee.role}` : committee.label}
        >
          {committee.isLeadership ? <Gavel className="size-3" /> : null}
          <span>{committee.label}</span>
          {committee.role ? (
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] opacity-75">
              {committee.role}
            </span>
          ) : null}
        </span>
      ))}
      {/* Count hidden from the source array that's actually rendered, not
          the max of both. If we render committees (preferred) and there are
          10 of them with a fallback list of 50, only 2 should appear as "+2",
          not "+42". */}
      {(() => {
        const sourceLength = committees.length ? committees.length : fallback.length;
        const hidden = Math.max(0, sourceLength - limit);
        if (hidden === 0) return null;
        return (
          <span className="rounded-md border border-zinc-800 bg-zinc-950/40 px-2 py-1 font-mono text-xs text-zinc-500">
            +{hidden}
          </span>
        );
      })()}
    </div>
  );
}
