import { notFound } from "next/navigation";
import { ReportGeneratorForm } from "@/components/reports/ReportGeneratorForm";
import "./fixture.css";

export const dynamic = "force-dynamic";

export default function ReportGeneratorFixturePage() {
  if (process.env.ALYSSA_E2E_FIXTURES !== "1" && process.env.NODE_ENV === "production") notFound();
  return (
    <main className="command-page report-generator-page" data-testid="report-generator-fixture">
      <div className="command-page-inner">
        <h1 className="command-page-title">報告生成</h1>
        <ReportGeneratorForm options={{
          defaultStartDate: "2026-10-01", defaultEndDate: "2026-10-07",
          brandOptions: [{ value: "", label: "全部品牌" }, { value: "gos", label: "GOS Beauty" }],
        }} />
      </div>
    </main>
  );
}
