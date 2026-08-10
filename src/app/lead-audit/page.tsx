import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DatabaseBackup,
  Diff,
  Filter,
  History,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { redirect } from "next/navigation";
import { reviewLeadAuditChangeAction } from "@/app/lead-audit/actions";
import { AppNav } from "@/components/alyssa/AppNav";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import {
  getLeadAuditView,
  type LeadAuditChangeView,
  type LeadAuditRunView,
} from "@/lib/marketing/leadSheetAuditView";
import { requireModuleAccess } from "@/lib/security/internalAccessServer";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function runStatusLabel(status: LeadAuditRunView["status"]) {
  if (status === "baseline") return "首次記錄";
  if (status === "completed") return "已保存";
  if (status === "quarantined") return "待調查";
  return "同步失敗";
}

function changeTypeLabel(value: string) {
  if (value === "added") return "新增";
  if (value === "modified") return "修改";
  if (value === "deleted") return "刪除";
  return "批量異動";
}

function reviewStatusLabel(value: string) {
  if (value === "expected") return "正常操作";
  if (value === "reviewed") return "已核對";
  if (value === "dismissed") return "已忽略";
  if (value === "informational") return "一般更新";
  return "待核對";
}

export default async function LeadAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{
    run?: string | string[];
    severity?: string | string[];
    review?: string | string[];
    audit_status?: string | string[];
    message?: string | string[];
  }>;
}) {
  const [moduleAccess, query] = await Promise.all([
    requireModuleAccess("lead_audit"),
    searchParams,
  ]);
  if (!moduleAccess.allowed) {
    redirect("/login?error=permission_denied&next=%2Flead-audit");
  }
  const runId = firstParam(query?.run) || null;
  const severity = firstParam(query?.severity) || "all";
  const reviewStatus = firstParam(query?.review) || "open";
  const view = await getLeadAuditView({
    access: moduleAccess.access,
    runId,
    severity,
    reviewStatus,
  });
  const message = firstParam(query?.message);
  const actionStatus = firstParam(query?.audit_status);
  const latestRun = view.runs[0] ?? null;

  return (
    <main className="alyssa-shell lead-audit-page">
      <AppNav
        access={moduleAccess.access}
        leadAuditAlertCount={Math.min(view.openCritical + view.openWarning, 99)}
      />
      <div className="command-page">
        <div className="command-page-inner">
          <header className="command-page-header lead-audit-header">
            <div>
              <p className="command-page-kicker">Lead 資料監管</p>
              <h1 className="command-page-title">Lead 變更監察</h1>
              <p className="command-page-subtitle">
                每日保存安全版本，比對上次同步，集中顯示新增、修改、刪除、狀態回退同批量異常。
              </p>
            </div>
            <div className="lead-audit-access-pill">
              <LockKeyhole size={15} />
              只限獲授權審核人員
            </div>
          </header>

          {message ? (
            <p
              className={`command-status-message ${
                actionStatus === "error" ? "is-error" : "is-success"
              }`}
            >
              {message}
            </p>
          ) : null}

          {!view.schemaReady || !view.encryptionReady || view.error ? (
            <section className="lead-audit-readiness is-warning">
              <CircleAlert size={20} />
              <div>
                <strong>資料監察暫時未能使用</strong>
                <p>
                  {!view.encryptionReady
                    ? "資料保護服務尚未完成設定，系統不會保存未受保護嘅 Lead 版本。"
                    : "監察服務尚未完成設定，請聯絡系統管理員。"}
                </p>
              </div>
            </section>
          ) : null}

          {view.openCritical > 0 ? (
            <section className="lead-audit-alert-banner">
              <AlertOctagon size={22} />
              <div>
                <strong>{view.openCritical} 項嚴重異常待核對</strong>
                <p>包括被刪除紀錄、關鍵欄位改寫、Show 狀態回退或來源大幅縮減。</p>
              </div>
              <a href="/lead-audit?review=open&severity=critical">
                立即檢查 <ArrowRight size={14} />
              </a>
            </section>
          ) : null}

          <section className="lead-audit-summary-grid" aria-label="Lead 變更監察摘要">
            <article>
              <span className="is-critical"><ShieldAlert size={17} /></span>
              <small>嚴重警報</small>
              <strong>{view.openCritical}</strong>
              <p>未完成核對</p>
            </article>
            <article>
              <span className="is-warning"><CircleAlert size={17} /></span>
              <small>注意警報</small>
              <strong>{view.openWarning}</strong>
              <p>需要確認操作</p>
            </article>
            <article>
              <span><Diff size={17} /></span>
              <small>最新異動</small>
              <strong>
                {view.scopeRestricted
                  ? "—"
                  : (latestRun?.addedCount ?? 0) +
                    (latestRun?.modifiedCount ?? 0) +
                    (latestRun?.deletedCount ?? 0)}
              </strong>
              <p>{view.scopeRestricted ? "只顯示獲授權品牌" : "對比上次同步"}</p>
            </article>
            <article>
              <span><DatabaseBackup size={17} /></span>
              <small>最近同步</small>
              <strong>{view.scopeRestricted ? "—" : latestRun?.rowCount ?? 0}</strong>
              <p>{latestRun ? formatDateTime(latestRun.completedAt) : "未有版本"}</p>
            </article>
          </section>

          <section className="lead-audit-workspace">
            <aside className="command-surface lead-audit-history">
              <header>
                <History size={18} />
                <div>
                  <strong>同步紀錄</strong>
                  <span>最近 30 次</span>
                </div>
              </header>
              <a
                href={`/lead-audit?review=${reviewStatus}&severity=${severity}`}
                className={!runId ? "is-active" : undefined}
              >
                <span>全部紀錄</span>
                <small>{view.runs.length} 次同步</small>
              </a>
              {view.runs.map((run) => (
                <a
                  key={run.id}
                  href={`/lead-audit?run=${run.id}&review=${reviewStatus}&severity=${severity}`}
                  className={runId === run.id ? "is-active" : undefined}
                >
                  <span>
                    <i className={`lead-run-dot is-${run.status}`} />
                    {run.snapshotDate}
                  </span>
                  <small>
                    {runStatusLabel(run.status)} · {view.scopeRestricted ? "獲授權品牌" : `${run.rowCount} 筆`}
                  </small>
                </a>
              ))}
            </aside>

            <div className="lead-audit-main-column">
              <form className="command-surface lead-audit-filters" method="get">
                {runId ? <input type="hidden" name="run" value={runId} /> : null}
                <Filter size={17} />
                <label>
                  <span>風險級別</span>
                  <select name="severity" defaultValue={severity}>
                    <option value="all">全部</option>
                    <option value="critical">嚴重</option>
                    <option value="warning">注意</option>
                    <option value="info">一般更新</option>
                  </select>
                </label>
                <label>
                  <span>審核狀態</span>
                  <select name="review" defaultValue={reviewStatus}>
                    <option value="open">待核對</option>
                    <option value="all">全部</option>
                    <option value="reviewed">已核對</option>
                    <option value="expected">正常操作</option>
                    <option value="dismissed">已忽略</option>
                    <option value="informational">一般更新</option>
                  </select>
                </label>
                <SubmitButton pendingLabel="篩選中…">套用篩選</SubmitButton>
              </form>

              <section className="lead-audit-change-list" aria-label="版本異動">
                <header>
                  <div>
                    <h2>本次更新有咩改動</h2>
                  </div>
                  <span>{view.changes.length} 項</span>
                </header>
                {view.changes.length === 0 ? (
                  <div className="command-surface lead-audit-empty">
                    <ShieldCheck size={30} />
                    <strong>所選條件冇待核對異常</strong>
                    <p>可切換至「全部」查看正常更新。</p>
                  </div>
                ) : (
                  view.changes.map((change) => (
                    <AuditChangeCard key={change.id} change={change} />
                  ))
                )}
              </section>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function AuditChangeCard({ change }: { change: LeadAuditChangeView }) {
  const open = change.reviewStatus === "open";
  return (
    <article className={`command-surface lead-audit-change is-${change.severity}`}>
      <header>
        <div className="lead-audit-change-title">
          <span>{changeTypeLabel(change.changeType)}</span>
          <div>
            <strong>{change.subjectLabel}</strong>
            <small>{change.summary}</small>
          </div>
        </div>
        <div className="lead-audit-change-meta">
          <span className={`lead-severity is-${change.severity}`}>
            {change.severity === "critical"
              ? "嚴重"
              : change.severity === "warning"
                ? "注意"
                : "一般"}
          </span>
          <time>
            <Clock3 size={12} /> {formatDateTime(change.createdAt)}
          </time>
        </div>
      </header>

      {change.changedFields.length > 0 ? (
        <div className="lead-audit-field-diffs">
          {change.changedFields.map((field) => (
            <div key={field.field}>
              <small>{field.label}</small>
              <span>{field.before}</span>
              <ArrowRight size={13} />
              <strong>{field.after}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {open && change.severity !== "info" ? (
        <details className="lead-audit-review">
          <summary>核對及處理警報</summary>
          <form action={reviewLeadAuditChangeAction}>
            <input type="hidden" name="changeId" value={change.id} />
            <textarea
              name="reviewNote"
              maxLength={1000}
              placeholder="可選：記錄 CS 解釋、核對結果或後續動作"
            />
            <div>
              <SubmitButton name="reviewStatus" value="expected" pendingLabel="儲存中…">
                <CheckCircle2 size={13} /> 正常操作
              </SubmitButton>
              <SubmitButton name="reviewStatus" value="reviewed" pendingLabel="儲存中…">
                <ShieldCheck size={13} /> 已核對
              </SubmitButton>
              <SubmitButton name="reviewStatus" value="dismissed" pendingLabel="儲存中…">
                忽略警報
              </SubmitButton>
            </div>
          </form>
        </details>
      ) : (
        <footer className="lead-audit-review-state">
          <ShieldCheck size={13} />
          {change.reviewStatus === "informational"
            ? "一般更新，毋須處理"
            : reviewStatusLabel(change.reviewStatus)}
          {change.reviewNote ? <span> · {change.reviewNote}</span> : null}
        </footer>
      )}
    </article>
  );
}
