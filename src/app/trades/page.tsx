import { redirect } from "next/navigation";

export const metadata = {
  title: "Congressional Trades",
};

export default function TradesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Forward any query params (filters, sort, page) to the dataset view
  return redirect("/datasets/congress-trades");
}
