import { redirect } from "next/navigation";

export const metadata = {
  title: "Politicians",
};

export default function PoliticiansPage() {
  return redirect("/datasets/politicians");
}
