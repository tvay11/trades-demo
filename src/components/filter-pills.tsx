import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

export function FilterPills({
  options,
  active,
  paramName,
  basePath,
  searchParams,
}: {
  options: FilterOption[];
  active: string;
  paramName: string;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  return (
    <div data-testid="filter-pills" className="ledger-filter-strip">
      {options.map((opt) => {
        const next = new URLSearchParams();
        for (const [k, v] of Object.entries(searchParams)) {
          if (v && k !== paramName) next.set(k, v);
        }
        if (opt.value !== options[0].value) next.set(paramName, opt.value);
        const qs = next.toString();
        const href = qs ? `${basePath}?${qs}` : basePath;
        const isActive = active === opt.value;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "ledger-stamp px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border border-sky-900/40 bg-sky-950/20 text-sky-400"
                : "border-transparent text-zinc-500 hover:border-zinc-700/70 hover:bg-zinc-900/70 hover:text-zinc-200"
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
