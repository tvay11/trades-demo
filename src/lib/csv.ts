export type CsvColumn<T extends Record<string, unknown>> = {
  key: string;
  label: string;
  format?: (value: unknown, row: T) => unknown;
};

export function toCsv<T extends Record<string, unknown>>(
  columns: CsvColumn<T>[],
  rows: T[],
) {
  const header = columns.map((column) => encodeCsvCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const raw = row[column.key];
        const value = column.format ? column.format(raw, row) : raw;
        return encodeCsvCell(formatCsvValue(value));
      })
      .join(","),
  );

  return [header, ...body].join("\r\n");
}

function formatCsvValue(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function encodeCsvCell(value: string) {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
