import { redirect } from "next/navigation";

export const metadata = {
  title: "Executive Officials",
};

export default function OfficialsPage() {
  return redirect("/datasets/executive-officials");
}
