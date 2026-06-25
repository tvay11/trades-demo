"use client";

import Link from "next/link";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Filter, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import type {
  DatasetDefinition,
  DatasetFilterDefinition,
  DatasetFilterGroupLabel,
} from "@/lib/datasets/registry";
import type {
  ActiveDatasetFilterChip,
  NormalizedDatasetQuery,
  NormalizedFilterValue,
} from "@/lib/datasets/filters";
import { cn } from "@/lib/utils";

export function DatasetFilterBar({
  definition,
  query,
  chips,
}: {
  definition: DatasetDefinition;
  query: NormalizedDatasetQuery;
  chips: ActiveDatasetFilterChip[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const groupedFilters = useMemo(
    () =>
      definition.filterGroups
        .map((group) => ({
          ...group,
          filters: definition.filters.filter((filter) => filter.group === group.label),
        }))
        .filter((group) => group.filters.length > 0),
    [definition.filterGroups, definition.filters],
  );

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, rawValue] of form.entries()) {
      const value = String(rawValue).trim();
      if (!value) continue;
      params.set(key, value);
    }

    const serialized = params.toString();
    const href = serialized ? `${pathname}?${serialized}` : pathname;

    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <form
      onSubmit={submitFilters}
      className="qq-panel overflow-hidden"
    >
      <div className="ledger-section-line p-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-[1.5fr_minmax(180px,220px)_140px_auto] md:items-end lg:grid-cols-[2fr_minmax(180px,240px)_140px_auto]">
          <label className="min-w-0 space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Search rows
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={query.search}
                placeholder={`Search ${definition.label.toLowerCase()}...`}
                className="h-10 pl-9"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Sort field
            </span>
            <AppSelect
              name="sort"
              defaultValue={query.sort.key}
              placeholder="Sort field"
              triggerClassName="h-10"
              options={definition.columns.map((column) => ({
                label: column.label,
                value: column.key,
              }))}
            />
          </label>

          <label className="space-y-2">
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Direction
            </span>
            <AppSelect
              name="dir"
              defaultValue={query.sort.dir}
              placeholder="Direction"
              triggerClassName="h-10"
              options={[
                { label: "Descending", value: "desc" },
                { label: "Ascending", value: "asc" },
              ]}
            />
          </label>

          <div className="flex items-end gap-2">
            <Button type="submit" className="h-10 px-4" disabled={isPending}>
              <Filter className="size-4" />
              {isPending ? "Applying" : "Apply"}
            </Button>
            <Link
              href={pathname}
              className="ledger-stamp inline-flex h-10 items-center justify-center border-zinc-700/70 bg-zinc-950/55 px-4 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-500/80 hover:text-zinc-200"
            >
              Reset
            </Link>
          </div>
        </div>
      </div>

      <div className="columns-1 gap-4 p-4 xl:columns-2">
        {groupedFilters.map((group) => (
          <FilterGroup
            key={group.label}
            group={group.label}
            description={group.description}
            filters={group.filters}
            query={query}
          />
        ))}
      </div>

      {chips.length > 0 ? (
        <div className="ledger-section-line border-t px-4 py-3">
          <div className="mb-2 flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">
            <ArrowDownWideNarrow className="size-3.5 text-sky-400" />
            Active filters
          </div>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <Link
                key={`${chip.key}-${chip.value}`}
                href={chip.href}
                className="ledger-stamp group inline-flex min-h-8 items-center gap-2 border-sky-900/40 bg-sky-950/20 px-2.5 py-1.5 text-xs text-sky-400 transition-colors hover:border-sky-800/70 hover:text-sky-300"
              >
                <span className="font-mono uppercase tracking-[0.12em] text-sky-500">
                  {chip.label}
                </span>
                <span className="max-w-[18rem] truncate font-mono text-zinc-100">
                  {chip.value}
                </span>
                <X className="size-3.5 opacity-70 transition group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="ledger-section-line border-t px-4 py-3 font-mono text-xs text-zinc-500">
          No extra filters applied. The table is showing the current SQL view with the default sort.
        </div>
      )}
    </form>
  );
}

function FilterGroup({
  group,
  description,
  filters,
  query,
}: {
  group: DatasetFilterGroupLabel;
  description?: string;
  filters: DatasetFilterDefinition[];
  query: NormalizedDatasetQuery;
}) {
  return (
    <section className="qq-metric mb-4 break-inside-avoid p-3 last:mb-0">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-sky-400">
            {group}
          </div>
          {description ? (
            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <ArrowUpNarrowWide className="mt-0.5 size-4 text-muted-foreground/70" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filters.map((filter) => (
          <FilterControl
            key={filter.key}
            filter={filter}
            value={query.filters[filter.key]}
          />
        ))}
      </div>
    </section>
  );
}

function FilterControl({
  filter,
  value,
}: {
  filter: DatasetFilterDefinition;
  value?: NormalizedFilterValue;
}) {
  switch (filter.kind) {
    case "text":
      return (
        <FilterField label={filter.label}>
          <Input
            name={`f_${filter.key}`}
            defaultValue={value?.kind === "text" ? value.value : ""}
            className="h-9"
          />
        </FilterField>
      );
    case "enum":
      return (
        <FilterField label={filter.label}>
          <AppSelect
            name={`f_${filter.key}`}
            defaultValue={value?.kind === "enum" ? value.value : ""}
            placeholder={filter.label}
            options={[
              { label: "Any", value: "" },
              ...(filter.options ?? []),
            ]}
          />
        </FilterField>
      );
    case "date-range":
      return (
        <FilterField label={filter.label}>
          <div className="grid grid-cols-2 gap-2">
            <DatePicker
              name={`f_${filter.key}_from`}
              defaultValue={value?.kind === "date-range" && value.from ? asDateInput(value.from) : ""}
              placeholder="From"
            />
            <DatePicker
              name={`f_${filter.key}_to`}
              defaultValue={value?.kind === "date-range" && value.to ? asDateInput(value.to) : ""}
              placeholder="To"
            />
          </div>
        </FilterField>
      );
    case "number-range":
      return (
        <FilterField label={filter.label}>
          <div className="grid grid-cols-2 gap-2">
            {filter.rangeOptions?.min ? (
              <AppSelect
                name={`f_${filter.key}_min`}
                defaultValue={value?.kind === "number-range" && value.min !== undefined ? String(value.min) : ""}
                placeholder="Min"
                options={filter.rangeOptions.min}
              />
            ) : (
              <Input
                type="number"
                name={`f_${filter.key}_min`}
                defaultValue={value?.kind === "number-range" && value.min !== undefined ? String(value.min) : ""}
                placeholder="Min"
                className="h-9"
              />
            )}
            {filter.rangeOptions?.max ? (
              <AppSelect
                name={`f_${filter.key}_max`}
                defaultValue={value?.kind === "number-range" && value.max !== undefined ? String(value.max) : ""}
                placeholder="Max"
                options={filter.rangeOptions.max}
              />
            ) : (
              <Input
                type="number"
                name={`f_${filter.key}_max`}
                defaultValue={value?.kind === "number-range" && value.max !== undefined ? String(value.max) : ""}
                placeholder="Max"
                className="h-9"
              />
            )}
          </div>
        </FilterField>
      );
    case "boolean":
      return (
        <FilterField label={filter.label}>
          <AppSelect
            name={`f_${filter.key}`}
            defaultValue={value?.kind === "boolean" ? String(value.value) : ""}
            placeholder={filter.label}
            options={[
              { label: "Any", value: "" },
              { label: "Yes", value: "true" },
              { label: "No", value: "false" },
            ]}
          />
        </FilterField>
      );
    case "presence":
      return (
        <FilterField label={filter.label}>
          <AppSelect
            name={`f_${filter.key}_state`}
            defaultValue={value?.kind === "presence" ? value.state : ""}
            placeholder={filter.label}
            options={[
              { label: "Any", value: "" },
              { label: "Present", value: "filled" },
              { label: "Empty", value: "empty" },
            ]}
          />
        </FilterField>
      );
  }
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="block font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className={cn("min-w-0", "[&_input]:w-full")}>{children}</div>
    </label>
  );
}

function asDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
