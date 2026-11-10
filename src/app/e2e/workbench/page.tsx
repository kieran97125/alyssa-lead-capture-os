import { notFound } from "next/navigation";
import Link from "next/link";
import { WorkbenchFixture } from "@/components/workbench/WorkbenchFixture";
export const dynamic = "force-dynamic";
export default async function WorkbenchFixturePage({ searchParams }: { searchParams: Promise<{ remote?: string; away?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.ALYSSA_E2E_FIXTURES !== "1") notFound();
  const params = await searchParams;
  if (params.away === "1") return <main><Link href="/e2e/workbench?remote=1">返回測試工作枱</Link></main>;
  return <main className="command-page"><WorkbenchFixture remotePersistence={params.remote === "1"} />{params.remote === "1" ? <Link href="/e2e/workbench?away=1">測試離開工作枱</Link> : null}</main>;
}
