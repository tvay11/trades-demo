import { format } from "date-fns";

export function parsePickerDate(value: string) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatPickerDateLabel(value: string) {
  const parsed = parsePickerDate(value);
  return parsed ? format(parsed, "MMM d, yyyy") : "Pick date";
}
