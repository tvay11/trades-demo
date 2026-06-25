import { redirect } from "next/navigation";

export const metadata = {
  title: "Insights",
};

export default function InsightsRedirectPage() {
  redirect("/");
}
