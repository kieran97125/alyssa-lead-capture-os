import { FileDown, FileText, Presentation, ShieldCheck } from "lucide-react";
import { AppNav } from "@/components/alyssa/AppNav";
import { ReportGeneratorForm } from "@/components/reports/ReportGeneratorForm";
import { getReportGeneratorOptions } from "@/lib/reports/snapshot";
import { SystemButton } from "@/components/system/SystemButton";
import { getGoogleSheetsOAuthStatus } from "@/lib/integrations/googleSheetsOAuth";
import { verifyCurrentInternalAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: {
  searchParams: Promise<{ command_status?: string; message?: string; reconnect_drive?: string }>;
}) {
  const [options, googleStatus, session, params] = await Promise.all([
    getReportGeneratorOptions(), getGoogleSheetsOAuthStatus(),
    verifyCurrentInternalAccess(), searchParams,
  ]);
  const canConnect = session.ok && session.access.accessLevel === "master";

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
                CS／AD 報數 · 統一使用已確認模版。
              </p>
              <div className="report-generator-trust-row">
                <span><FileText size={14} /> 可搜尋向量 PDF</span>
                <span><Presentation size={14} /> Google Slides · 報告資料夾</span>
                <span><ShieldCheck size={14} /> 不包含客戶個人資料</span>
              </div>
            </div>
            <div className="report-generator-header-mark" aria-hidden="true">
              <FileDown size={28} />
            </div>
          </header>

          {params.message ? <p className={`command-status-message ${params.command_status === "success" ? "is-success" : "is-error"}`} role={params.command_status === "success" ? "status" : "alert"}>{params.message}</p> : null}
          {(!googleStatus.reportDeliveryEnabled || params.reconnect_drive === "1") && canConnect ? (
            <section className="command-surface report-generator-section" aria-label="Google Drive 報告連接">
              <form action="/api/integrations/google-sheets/start?purpose=reports" method="post">
                <SystemButton type="submit" variant="outline"><Presentation size={16} aria-hidden="true" />連接 Google Drive</SystemButton>
              </form>
              <p className="text-sm text-system-muted-foreground">Google 會要求存取及管理 Drive 檔案權限；系統會將報告儲存到指定資料夾。</p>
            </section>
          ) : null}

          <ReportGeneratorForm options={options} canConnectGoogleDrive={canConnect} />
        </div>
      </div>
    </main>
  );
}
