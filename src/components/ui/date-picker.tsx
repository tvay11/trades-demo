"use client";

import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatPickerDateLabel, parsePickerDate } from "@/lib/date-picker";
import { cn } from "@/lib/utils";

function DatePicker({
  name,
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Pick date",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = controlled ? (value ?? "") : internalValue;
  const selectedDate = parsePickerDate(currentValue);
  const [visibleMonth, setVisibleMonth] = useState(
    selectedDate ?? new Date(),
  );

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [visibleMonth]);

  function commit(nextValue: string) {
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  return (
    <Popover>
      <input type="hidden" name={name} value={currentValue} readOnly />
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="ledger-field h-9 justify-between px-3 font-normal hover:bg-zinc-900/70"
          />
        }
      >
        <span className={cn("inline-flex min-w-0 items-center gap-2 truncate", !selectedDate && "text-muted-foreground")}>
          <CalendarDays className="size-4 shrink-0" />
          {selectedDate ? formatPickerDateLabel(currentValue) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-[19rem] p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVisibleMonth((month) => subMonths(month, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="font-mono text-sm font-semibold uppercase tracking-[0.12em]">
            {format(visibleMonth, "MMM yyyy")}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVisibleMonth((month) => addMonths(month, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 pb-2 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted-foreground">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div key={day} className="py-1 text-center">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const active = selectedDate ? isSameDay(day, selectedDate) : false;
            const inMonth = isSameMonth(day, visibleMonth);

            return (
              <PopoverClose
                key={day.toISOString()}
                render={
                  <button
                    type="button"
                    onClick={() => commit(format(day, "yyyy-MM-dd"))}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-sm border border-transparent font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30",
                      active
                        ? "border-sky-900/50 bg-sky-950/30 text-sky-300"
                        : inMonth
                          ? "text-zinc-100 hover:border-sky-900/40 hover:bg-sky-950/15"
                          : "text-zinc-600 hover:bg-zinc-900/60",
                    )}
                  />
                }
              >
                {format(day, "d")}
              </PopoverClose>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-700/70 pt-3">
          <PopoverClose
            render={
              <Button type="button" variant="outline" size="sm" onClick={() => commit("")} />
            }
          >
            <X className="size-3.5" />
            Clear
          </PopoverClose>
          <PopoverClose
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  setVisibleMonth(today);
                  commit(format(today, "yyyy-MM-dd"));
                }}
              />
            }
          >
            Today
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };
