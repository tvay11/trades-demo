import { notFound } from "next/navigation";

import { datasetRowsToCsv } from "@/lib/datasets/csv";
import { DATASET_EXPORT_LIMIT, getDatasetExportRows } from "@/lib/datasets/queries";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const url = new URL(request.url);
  const exportData = await getDatasetExportRows(slug, searchParamsToRecord(url.searchParams));

  if (!exportData) notFound();

  const csv = datasetRowsToCsv(exportData.definition, exportData.rows);
  const filename = `${exportData.definition.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Total-Rows": String(exportData.totalRows),
      "X-Exported-Rows": String(exportData.exportedRows),
      "X-Export-Limit": String(DATASET_EXPORT_LIMIT),
      "X-Export-Truncated": String(exportData.truncated),
    },
  });
}

function searchParamsToRecord(params: URLSearchParams) {
  const record: Record<string, string | string[]> = {};
  for (const key of params.keys()) {
    const values = params.getAll(key);
    record[key] = values.length > 1 ? values : (values[0] ?? "");
  }
  return record;
}
