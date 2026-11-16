import { SystemButton } from "@/components/system/SystemButton";
import { SubmitButton } from "@/components/alyssa/SubmitButton";
import type { LeadDeliveryCounts, LeadDeliverySummary } from "@/lib/capture/deliverySummary";
import type { LeadDeliveryRecoveryAccess } from "@/app/system-audit/actions";

export type LeadDeliveryRecoveryFeedback =
  | { status: "scheduled"; count: number }
  | { status: "failed" | "forbidden" | "member_required" | "unavailable" };

export function parseLeadDeliveryRecoveryFeedback(query: Record<string, string | string[] | undefined>): LeadDeliveryRecoveryFeedback | undefined {
  const status = typeof query.delivery_recheck === "string" ? query.delivery_recheck : "";
  const count = typeof query.delivery_count === "string" && /^(?:[0-9]|10)$/.test(query.delivery_count) ? Number(query.delivery_count) : null;
  if (status === "scheduled" && count !== null) return { status, count };
  if (status === "failed" || status === "forbidden" || status === "member_required" || status === "unavailable") return { status };
  return undefined;
}

const groups: Array<{ key: string; label: string; value: (counts: LeadDeliveryCounts) => number }> = [
  { key: "pending", label: "待同步", value: counts => counts.pending },
  { key: "working", label: "同步／重試中", value: counts => counts.processing + counts.retry },
  { key: "delivered", label: "已同步", value: counts => counts.delivered },
  { key: "blocked", label: "需要處理", value: counts => counts.blocked },
  { key: "uncertain", label: "待核對", value: counts => counts.uncertain },
  { key: "skipped", label: "已略過", value: counts => counts.skipped },
];

function checkedAtLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong", dateStyle: "short", timeStyle: "short",
  }).format(date);
}

function feedbackMessage(feedback: LeadDeliveryRecoveryFeedback) {
  if (feedback.status === "scheduled") return feedback.count > 0 ? `已安排重新檢查 ${feedback.count} 筆同步記錄。` : "暫時未有需要重新檢查嘅同步記錄。";
  if (feedback.status === "forbidden") return "你未獲授權重新檢查同步。";
  if (feedback.status === "member_required") return "目前登入方式未能記錄操作人，請使用管理員電郵登入後再試。";
  if (feedback.status === "unavailable") return "暫時未能確認操作權限或連接資料服務，請稍後再試。";
  return "未能安排重新檢查，請重新載入後再試。";
}

export function LeadDeliveryStatusPanel({ summary, recoveryAccess, recheckAction, feedback }: {
  summary: LeadDeliverySummary;
  recoveryAccess?: LeadDeliveryRecoveryAccess;
  recheckAction?: () => void | Promise<void>;
  feedback?: LeadDeliveryRecoveryFeedback;
}) {
  const checkedAt = summary.available ? checkedAtLabel(summary.checkedAt) : "";
  const hasRecoveryCandidates = summary.available && summary.counts.blocked + summary.counts.uncertain > 0;
  return (
    <section
      className="rounded-[var(--radius-panel)] border border-system-border bg-system-card p-5 text-system-foreground shadow-sm"
      aria-labelledby="lead-delivery-heading"
      data-testid="lead-delivery-status-panel"
      data-availability={summary.available ? "ready" : "unavailable"}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="lead-delivery-heading" className="text-xl font-semibold">登記同步</h2>
          <p className="mt-2 text-sm leading-6 text-system-muted-foreground">查看已儲存登記同步至 Lead Sheet 嘅情況。</p>
        </div>
        <SystemButton density="compact" variant="outline" nativeButton={false} render={<a href="/system-audit" />}>
          重新載入
        </SystemButton>
      </header>
      {feedback && <p className="mt-4 rounded-[var(--radius-control)] border border-system-border bg-system-accent px-4 py-3 text-sm leading-6" role="status" data-testid="lead-delivery-feedback">{feedbackMessage(feedback)}</p>}
      {!summary.available ? (
        <p className="mt-4 rounded-[var(--radius-control)] bg-system-muted px-4 py-3 text-sm leading-6 text-system-muted-foreground" role="status">
          {summary.reason === "not_configured" ? "登記同步尚未完成設定。" : "暫時未能讀取同步紀錄，請重新載入。"}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-system-muted-foreground">累計 <strong className="tabular-nums text-system-foreground" data-testid="lead-delivery-total">{summary.total.toLocaleString("en-HK")}</strong> 筆</p>
          {summary.total === 0 ? (
            <p className="mt-3 text-sm leading-6 text-system-muted-foreground" role="status">暫時未有登記同步記錄。</p>
          ) : (
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              {groups.map(group => (
                <div key={group.key} className="rounded-[var(--radius-control)] border border-system-border bg-system-secondary p-4" data-delivery-group={group.key}>
                  <dt className="text-sm font-medium text-system-muted-foreground">{group.label}</dt>
                  <dd className="mt-2 text-2xl font-semibold tabular-nums">{group.value(summary.counts).toLocaleString("en-HK")}</dd>
                </div>
              ))}
            </dl>
          )}
          {(summary.counts.blocked > 0 || summary.counts.uncertain > 0) && (
            <p className="mt-4 rounded-[var(--radius-control)] border border-system-border bg-system-accent px-4 py-3 text-sm leading-6" role="status">
              {summary.counts.blocked > 0 ? `有 ${summary.counts.blocked.toLocaleString("en-HK")} 筆需要處理。` : ""}
              {summary.counts.uncertain > 0 ? "待核對記錄會先確認同步結果，避免重複加入。" : ""}
            </p>
          )}
          {hasRecoveryCandidates && recoveryAccess && (
            <div className="mt-4 space-y-2">
              {recoveryAccess.allowed && recheckAction ? (
                <form action={recheckAction}>
                  <SystemButton type="submit" density="compact" render={<SubmitButton pendingLabel="正在安排…">重新檢查同步</SubmitButton>}>重新檢查同步</SystemButton>
                  <p className="mt-2 text-xs leading-5 text-system-muted-foreground">每次最多檢查 10 筆；先核對現有結果，再恢復可重試嘅同步。</p>
                </form>
              ) : (
                <>
                  <SystemButton type="button" density="compact" disabled>重新檢查同步</SystemButton>
                  <p className="text-xs leading-5 text-system-muted-foreground">
                    {!recoveryAccess.allowed && recoveryAccess.reason === "member_required" ? "目前登入方式未能記錄操作人，請使用管理員電郵登入後重新檢查。" : !recoveryAccess.allowed && recoveryAccess.reason === "permission_required" ? "你未獲授權重新檢查同步。" : "暫時未能確認重新檢查權限，請稍後再試。"}
                  </p>
                </>
              )}
            </div>
          )}
          {checkedAt && <p className="mt-4 text-xs text-system-muted-foreground">更新於 {checkedAt}（香港時間）</p>}
        </>
      )}
    </section>
  );
}
