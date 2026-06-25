import { toCsv, type CsvColumn } from "@/lib/csv";
import type { DatasetColumn, DatasetDefinition, DatasetRow } from "./registry";

export function datasetRowsToCsv(definition: DatasetDefinition, rows: DatasetRow[]) {
  const columns: CsvColumn<DatasetRow>[] = definition.columns.map((column) => ({
    key: column.key,
    label: column.label,
    format: (value) => formatDatasetCsvValue(value, column),
  }));

  return toCsv(columns, rows);
}

function formatDatasetCsvValue(value: unknown, column: DatasetColumn) {
  if (value == null || value === "") return "";

  switch (column.kind) {
    case "date": {
      const date = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
    }
    case "cents": {
      const cents = Number(value);
      return Number.isFinite(cents) ? cents / 100 : String(value);
    }
    case "ticker":
      return String(value).toUpperCase();
    default:
      return value;
  }
}
