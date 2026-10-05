import { notFound } from "next/navigation";
import { DashboardLoadingSpecimen } from "@/components/command-center/DashboardLoadingSpecimen";

export default function DashboardStreamingFixturePage() {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
  return <DashboardLoadingSpecimen />;
}
