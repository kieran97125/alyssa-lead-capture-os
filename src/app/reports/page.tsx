import { FileDown, FileText, Presentation, ShieldCheck } from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { ReportGeneratorForm } from "@/components/reports/ReportGeneratorForm";
import { getReportGeneratorOptions } from "@/lib/reports/snapshot";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const options = await getReportGeneratorOptions();

  return (
    <main className="alyssa-shell">
      <AppNav />
      <div className="command-page report-generator-page">
        <div className="command-page-inner">
          <header className="command-page-header report-generator-header">
            <div>
              <p className="command-page-kicker">Management reporting</p>
              <h1 className="command-page-title">報告生成</h1>
              <p className="command-page-subtitle">
                用同一份不可修改快照生成可搜尋 PDF 或可編輯 PowerPoint，並按需要追加品牌及療程 Breakdown。
              </p>
              <div className="report-generator-trust-row">
                <span><FileText size={14} /> 可搜尋向量 PDF</span>
                <span><Presentation size={14} /> 可編輯 PPTX</span>
                <span><ShieldCheck size={14} /> 不包含客戶個人資料</span>
              </div>
            </div>
            <div className="report-generator-header-mark" aria-hidden="true">
              <FileDown size={28} />
            </div>
          </header>

          <ReportGeneratorForm options={options} />
        </div>
      </div>
    </main>
  );
}
