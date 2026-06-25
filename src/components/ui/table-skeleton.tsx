import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export type TableSkeletonColumn = {
  label: string;
  align?: "left" | "right";
};

type TableSkeletonProps = {
  columns: TableSkeletonColumn[];
  rows?: number;
};

export function TableSkeleton({ columns, rows = 8 }: TableSkeletonProps) {
  return (
    <div className="qq-table-shell">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead
                key={c.label}
                className={c.align === "right" ? "text-right" : undefined}
              >
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {columns.map((c) => (
                <TableCell
                  key={c.label}
                  className={c.align === "right" ? "text-right" : undefined}
                >
                  <Skeleton
                    className={
                      c.align === "right" ? "ml-auto h-4 w-20" : "h-4 w-28"
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
