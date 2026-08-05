"use client";

import { FormEvent, useState } from "react";

type Brand = { id: string; name: string; slug: string };
type Template = {
  id: string;
  template_name: string;
  language_code: string;
  category: string | null;
};
type Broadcast = {
  id: string;
  name: string;
  status: string;
  eligible_count: number;
  excluded_count: number;
  queued_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  opt_out_count: number;
  frequency_cap_days: number;
  created_at: string;
  last_error: string | null;
  template_id: string;
};

type Props = {
  brand: Brand;
  broadcasts: Broadcast[];
  templates: Template[];
  consentCount: number;
  suppressionCount: number;
  liveSendEnabled: boolean;
};

const inputClass =
  "h-10 w-full rounded-lg border border-[#dbe2ea] bg-white px-3 text-sm font-semibold text-[#334155] outline-none transition focus:border-[var(--crm-accent)] focus:ring-2 focus:ring-[var(--crm-accent-border)] disabled:bg-[#f8fafc]";
const primaryButtonClass =
  "mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--crm-accent)] px-4 text-sm font-black text-white transition hover:bg-[#0f688a] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]";
const secondaryButtonClass =
  "mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-[#cbd5e1] bg-white px-4 text-sm font-black text-[#334155] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:text-[#94a3b8]";

export function WhatsAppBroadcastsPanel({
  brand,
  broadcasts,
  templates,
  consentCount,
  suppressionCount,
  liveSendEnabled,
}: Props) {
  const [busyKey, setBusyKey] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function runAction(key: string, payload: Record<string, unknown>) {
    setBusyKey(key);
    setFeedback(null);
    try {
      const response = await fetch("/api/crm/whatsapp/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;
      const message = typeof result?.message === "string" ? result.message : "request_failed";
      if (!response.ok || !result?.ok) {
        setFeedback({
          tone: "error",
          text: humanMessage(message, result?.detail),
        });
        return;
      }
      setFeedback({ tone: "success", text: humanMessage(message) });
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "未能連接伺服器。",
      });
    } finally {
      setBusyKey("");
    }
  }

  async function submitBroadcast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction("create", {
      action: "create_campaign",
      brand_slug: brand.slug,
      name: form.get("name"),
      template_id: form.get("template_id"),
      frequency_cap_days: form.get("frequency_cap_days"),
    });
  }

  async function submitConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runAction("consent", {
      action: "record_consent",
      brand_slug: brand.slug,
      phone: form.get("phone"),
      consent_source: form.get("consent_source"),
      evidence_note: form.get("evidence_note"),
    });
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
      <section className="rounded-2xl border border-[var(--crm-accent-border)] bg-[linear-gradient(135deg,#ffffff_0%,#f5fbfe_55%,#dff4fb_100%)] p-5 shadow-[0_18px_55px_rgba(22,127,166,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--crm-accent)]">
              CRM Message Operations
            </p>
            <h1 className="mt-2 text-2xl font-black text-[#111827]">
              WhatsApp Broadcast / 批量發送
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748b]">
              CRM 只負責安全執行：同意紀錄、收件人資格檢查、Approved Template、Dry Run、審批、排隊、送達狀態、退訂及緊急停止。客群策略與成效分析由 GrowthRadar 負責。
            </p>
          </div>
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-black ${
              liveSendEnabled
                ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
            }`}
          >
            {liveSendEnabled ? "真實發送已啟用" : "安全模式：不會真實發送"}
            <p className="mt-1 text-[11px] font-semibold opacity-80">
              {liveSendEnabled
                ? "只會處理已完成安全檢查及批准嘅群發工作。"
                : "目前可建立、安全檢查及批准，但不會向客人發送。"}
            </p>
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm font-bold ${
            feedback.tone === "success"
              ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
              : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="有效同意" value={consentCount} note="可進入資格檢查" />
        <MetricCard label="退訂／排除" value={suppressionCount} note="不會發送" />
        <MetricCard label="已批准範本" value={templates.length} note="Meta 營銷訊息範本" />
        <MetricCard label="群發工作" value={broadcasts.length} note="操作紀錄" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <form
          onSubmit={submitBroadcast}
          className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--crm-accent)]">
            群發設定
          </p>
          <h2 className="mt-1 text-lg font-black text-[#111827]">
            建立批量發送工作
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="名稱">
              <input
                name="name"
                required
                maxLength={200}
                placeholder="例：IB 舊客服務通知"
                className={inputClass}
              />
            </Field>
            <Field label="已批准訊息範本">
              <select
                name="template_id"
                required
                className={inputClass}
                defaultValue=""
              >
                <option value="" disabled>
                  選擇範本
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.template_name} · {template.language_code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="同一客戶冷卻期">
              <select
                name="frequency_cap_days"
                className={inputClass}
                defaultValue="30"
              >
                <option value="14">14 日</option>
                <option value="30">30 日</option>
                <option value="60">60 日</option>
                <option value="90">90 日</option>
              </select>
            </Field>
            <div className="rounded-xl border border-[var(--crm-accent-border)] bg-[var(--crm-accent-soft)] px-3 py-3 text-xs leading-5 text-[#123a4a]">
              系統會先去重，再檢查發送同意、退訂狀態、電話格式、訊息變數同冷卻期。
            </div>
          </div>
          <button
            disabled={busyKey === "create" || templates.length === 0}
            className={primaryButtonClass}
          >
            {busyKey === "create" ? "建立中…" : "建立草稿"}
          </button>
        </form>

        <form
          onSubmit={submitConsent}
          className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f766e]">
            發送同意
          </p>
          <h2 className="mt-1 text-lg font-black text-[#111827]">
            記錄 WhatsApp 發送同意
          </h2>
          <p className="mt-2 text-xs leading-5 text-[#64748b]">
            只可記錄真實、可追溯嘅同意證據；已退訂客人不會自動解除排除。
          </p>
          <div className="mt-4 space-y-3">
            <Field label="客戶電話">
              <input
                name="phone"
                required
                placeholder="例如 85291234567"
                className={inputClass}
              />
            </Field>
            <Field label="同意來源">
              <select
                name="consent_source"
                required
                className={inputClass}
                defaultValue=""
              >
                <option value="" disabled>
                  選擇來源
                </option>
                <option value="website_checkbox">網站同意選項</option>
                <option value="whatsapp_reply">WhatsApp 主動確認</option>
                <option value="store_membership_form">分店會員表格</option>
                <option value="signed_customer_form">已簽署客戶表格</option>
              </select>
            </Field>
            <Field label="證據備註">
              <textarea
                name="evidence_note"
                required
                maxLength={1000}
                rows={3}
                placeholder="寫明日期、同意方式及證據保存位置。"
                className={`${inputClass} h-auto py-2`}
              />
            </Field>
          </div>
          <button disabled={busyKey === "consent"} className={secondaryButtonClass}>
            {busyKey === "consent" ? "記錄中…" : "記錄同意"}
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--crm-accent)]">
              群發管理
            </p>
            <h2 className="mt-1 text-lg font-black text-[#111827]">發送工作</h2>
          </div>
          <p className="text-xs font-semibold text-[#64748b]">
            草稿 → 安全檢查 → 批准 → 排隊 → 發送
          </p>
        </div>

        {broadcasts.length ? (
          <div className="mt-4 grid gap-3">
            {broadcasts.map((broadcast) => (
              <BroadcastRow
                key={broadcast.id}
                broadcast={broadcast}
                templateName={
                  templates.find((template) => template.id === broadcast.template_id)
                    ?.template_name || "訊息範本"
                }
                liveSendEnabled={liveSendEnabled}
                busyKey={busyKey}
                onAction={runAction}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-5 py-10 text-center text-sm font-semibold text-[#64748b]">
            暫時未有群發工作。請先建立草稿，再進行安全檢查。
          </div>
        )}
      </section>
    </div>
  );
}

function BroadcastRow({
  broadcast,
  templateName,
  liveSendEnabled,
  busyKey,
  onAction,
}: {
  broadcast: Broadcast;
  templateName: string;
  liveSendEnabled: boolean;
  busyKey: string;
  onAction: (key: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const busy = busyKey.startsWith(broadcast.id);
  return (
    <article className="rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-black text-[#111827]">
              {broadcast.name}
            </h3>
            <StatusPill status={broadcast.status} />
          </div>
          <p className="mt-1 text-xs font-semibold text-[#64748b]">
            {templateName} · 冷卻期 {broadcast.frequency_cap_days} 日 · {formatDate(broadcast.created_at)}
          </p>
          {broadcast.last_error ? (
            <p className="mt-1 text-xs font-bold text-[#b91c1c]">
              {broadcast.last_error}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          <MiniMetric label="合資格" value={broadcast.eligible_count} />
          <MiniMetric label="排除" value={broadcast.excluded_count} />
          <MiniMetric label="排隊" value={broadcast.queued_count} />
          <MiniMetric label="已發" value={broadcast.sent_count} />
          <MiniMetric label="送達" value={broadcast.delivered_count} />
          <MiniMetric label="已讀" value={broadcast.read_count} />
          <MiniMetric label="失敗" value={broadcast.failed_count} />
          <MiniMetric label="退訂" value={broadcast.opt_out_count} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eef2f6] pt-3">
        {["draft", "dry_run_ready", "paused"].includes(broadcast.status) ? (
          <ActionButton
            disabled={busy}
            onClick={() =>
              onAction(`${broadcast.id}:dry`, {
                action: "dry_run",
                campaign_id: broadcast.id,
              })
            }
          >
            安全檢查
          </ActionButton>
        ) : null}
        {broadcast.status === "dry_run_ready" ? (
          <ActionButton
            disabled={busy || broadcast.eligible_count < 1}
            onClick={() =>
              onAction(`${broadcast.id}:approve`, {
                action: "approve",
                campaign_id: broadcast.id,
              })
            }
          >
            批准
          </ActionButton>
        ) : null}
        {broadcast.status === "approved" ? (
          <ActionButton
            disabled={busy || !liveSendEnabled}
            onClick={() =>
              onAction(`${broadcast.id}:queue`, {
                action: "queue",
                campaign_id: broadcast.id,
              })
            }
          >
            {liveSendEnabled ? "加入發送隊列" : "安全模式"}
          </ActionButton>
        ) : null}
        {["queued", "sending"].includes(broadcast.status) ? (
          <>
            <ActionButton
              disabled={busy || !liveSendEnabled}
              onClick={() =>
                onAction(`${broadcast.id}:process`, {
                  action: "process_batch",
                  campaign_id: broadcast.id,
                  batch_size: 10,
                })
              }
            >
              處理 10 個
            </ActionButton>
            <ActionButton
              tone="warning"
              disabled={busy}
              onClick={() =>
                onAction(`${broadcast.id}:pause`, {
                  action: "pause",
                  campaign_id: broadcast.id,
                  reason: "manual_pause",
                })
              }
            >
              暫停
            </ActionButton>
          </>
        ) : null}
        {!(["completed", "cancelled"].includes(broadcast.status)) ? (
          <ActionButton
            tone="danger"
            disabled={busy}
            onClick={() =>
              onAction(`${broadcast.id}:cancel`, {
                action: "cancel",
                campaign_id: broadcast.id,
              })
            }
          >
            取消
          </ActionButton>
        ) : null}
      </div>
    </article>
  );
}

function MetricCard({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <article className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-[#111827]">{value.toLocaleString()}</p>
      <p className="mt-1 text-[11px] font-semibold text-[#94a3b8]">{note}</p>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[58px] rounded-lg bg-white px-2 py-2 text-center ring-1 ring-[#eef2f6]">
      <p className="text-[9px] font-black text-[#94a3b8]">{label}</p>
      <p className="mt-0.5 text-sm font-black text-[#334155]">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-[#f1f5f9] text-[#475569]",
    dry_run_ready: "bg-[#dff4fb] text-[#167fa6]",
    approved: "bg-[#dbeafe] text-[#1d4ed8]",
    queued: "bg-[#fef3c7] text-[#92400e]",
    sending: "bg-[#e0f2fe] text-[#0369a1]",
    paused: "bg-[#fee2e2] text-[#b91c1c]",
    completed: "bg-[#dcfce7] text-[#166534]",
    cancelled: "bg-[#f1f5f9] text-[#64748b]",
    failed: "bg-[#fee2e2] text-[#991b1b]",
  };
  const labels: Record<string, string> = {
    draft: "草稿",
    dry_run_ready: "已完成安全檢查",
    approved: "已批准",
    queued: "排隊中",
    sending: "發送中",
    paused: "已暫停",
    completed: "已完成",
    cancelled: "已取消",
    failed: "失敗",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${styles[status] || styles.draft}`}>
      {labels[status] || status}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "default" | "warning" | "danger";
}) {
  const style =
    tone === "danger"
      ? "border-[#fecaca] bg-white text-[#b91c1c] hover:bg-[#fef2f2]"
      : tone === "warning"
        ? "border-[#fde68a] bg-white text-[#92400e] hover:bg-[#fffbeb]"
        : "border-[var(--crm-accent-border)] bg-white text-[var(--crm-accent)] hover:bg-[var(--crm-accent-soft)]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 rounded-lg border px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:border-[#e2e8f0] disabled:text-[#94a3b8] ${style}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black text-[#475569]">{label}</span>
      {children}
    </label>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-HK", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function humanMessage(message: string, detail?: unknown) {
  const labels: Record<string, string> = {
    campaign_created: "群發草稿已建立。",
    consent_recorded: "發送同意已記錄。",
    consent_recorded_but_still_suppressed: "發送同意已記錄，但此電話仍在退訂名單，系統不會發送。",
    dry_run_completed: "安全檢查已完成，請先核對合資格與排除數量。",
    campaign_approved: "群發工作已批准。",
    campaign_queued: "群發工作已進入安全發送隊列。",
    campaign_batch_processed: "本批次已處理。",
    campaign_paused: "群發工作已暫停。",
    campaign_cancelled: "群發工作已取消。",
    live_send_disabled: "真實發送尚未啟用，系統保持安全模式。",
    migration_not_applied: "WhatsApp 群發功能尚未完成設定。",
    approved_template_required: "必須使用 Meta 已批准而且未過期嘅訊息範本。",
    marketing_template_required: "此功能只容許 Meta 營銷類別訊息範本。",
    dry_run_required_before_approval: "必須先完成安全檢查。",
    no_eligible_recipients: "目前沒有合資格收件人。",
    valid_phone_required: "請輸入有效電話號碼。",
    consent_evidence_required: "必須填寫同意來源及證據備註。",
    unauthorized: "登入已失效或沒有權限。",
  };
  const base = labels[message] || message;
  return detail ? `${base} (${String(detail)})` : base;
}
