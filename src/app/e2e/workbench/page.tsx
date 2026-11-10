import { notFound } from "next/navigation";
import { WorkbenchFixture } from "@/components/workbench/WorkbenchFixture";
export const dynamic = "force-dynamic";
export default function WorkbenchFixturePage() {
  if (process.env.NODE_ENV === "production" && process.env.ALYSSA_E2E_FIXTURES !== "1") notFound();
  return <main className="command-page"><WorkbenchFixture /></main>;
}
