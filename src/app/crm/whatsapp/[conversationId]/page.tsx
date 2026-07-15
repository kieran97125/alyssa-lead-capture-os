import Link from "next/link";
import { notFound } from "next/navigation";
import { CrmShell } from "@/components/crm/CrmShell";
import { WhatsAppConversationComposer } from "@/components/crm/WhatsAppConversationComposer";
import {
  findLeadCandidatesForConversation,
  getWhatsAppConversationWorkspace,
  getWhatsAppServiceWindowState,
  markWhatsAppConversationRead,
} from "@/lib/crm/whatsappInbox";
import {
  addWhatsAppInternalNoteAction,
  linkConversationToLeadAction,
  setConversationArchiveAction,
} from "../actions";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WhatsAppConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ conversationId }, query] = await Promise.all([params, searchParams]);
  const workspace = await getWhatsAppConversationWorkspace(conversationId);
  if (!workspace.tableReady) {
    return (
      <CrmShell active="whatsapp">
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
            <h1 className="text-lg font-black">Phase 2B SQL 尚未套用</h1>
            <p className="mt-2 text-sm font-semibold">
              請先 review 並套用 docs/CRM_WHATSAPP_PHASE2B_APPLY.sql。
            </p>
          </div>
        </div>
      </CrmShell>
    );
  }
  if (!workspace.conversation) notFound();

  await markWhatsAppConversationRead(conversationId);
  const candidates = workspace.conversation.lead_id
    ? []
    : await findLeadCandidatesForConversation(conversationId);
  const feedback = firstParam(query?.success) || firstParam(query?.error) || "";
  const conversation = workspace.conversation;
  const serviceWindowState = getWhatsAppServiceWindowState(
    conversation.last_inbound_at
  );

  return (
    <CrmShell active="whatsapp">
      <main className="min-h-screen bg-[#f8fafc]">
        <header className="border-b border-[#e5e7eb] bg-white px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href="/crm/whatsapp"
                className="text-xs font-black text-[#6366f1] hover:text-[#4338ca]"
              >
                ← WhatsApp Inbox
              </Link>
              <h1 className="mt-2 text-xl font-black text-[#111827]">
                {conversation.customer_name || conversation.customer_phone}
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                {conversation.customer_phone} · {conversation.lead_id ? "已配對 Lead" : "未配對"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ServiceWindowBadge state={serviceWindowState} />
              {conversation.lead_id ? (
                <Link
                  href={`/crm/leads/${conversation.lead_id}`}
                  className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-black text-[#334155]"
                >
                  開啟完整 Lead
                </Link>
              ) : null}
              <form action={setConversationArchiveAction}>
                <input type="hidden" name="conversationId" value={conversation.id} />
                <input
                  type="hidden"
                  name="status"
                  value={conversation.status === "archived" ? "active" : "archived"}
                />
                <button className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-black text-[#64748b]">
                  {conversation.status === "archived" ? "取消封存" : "封存對話"}
                </button>
              </form>
            </div>
          </div>
          {feedback ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
              {feedback}
            </div>
          ) : null}
        </header>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:p-6">
          <div className="grid min-w-0 gap-4">
            <section className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
              <div className="border-b border-[#eef2f6] px-4 py-3">
                <h2 className="text-sm font-black text-[#111827]">完整對話</h2>
                <p className="mt-1 text-xs font-semibold text-[#94a3b8]">
                  狀態會由 Meta webhook 更新為 sent / delivered / read / failed。
                </p>
              </div>
              <div className="max-h-[58vh] space-y-3 overflow-y-auto bg-[#f8fafc] p-4">
                {workspace.messages.length ? (
                  workspace.messages.map((message) => (
                    <article
                      key={message.id}
                      className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${
                          message.direction === "outbound"
                            ? "rounded-br-md bg-[#dcf8c6] text-[#1f2937]"
                            : "rounded-bl-md border border-[#e2e8f0] bg-white text-[#1f2937]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-6">
                          {message.body || `[${message.message_type}]`}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-[10px] font-bold text-[#64748b]">
                          {message.template_name ? (
                            <span>Template: {message.template_name}</span>
                          ) : null}
                          <span>{formatDateTime(message.created_at)}</span>
                          {message.direction === "outbound" ? (
                            <MessageStatus status={message.status} />
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="py-10 text-center text-sm font-semibold text-[#94a3b8]">
                    暫時未有訊息。
                  </p>
                )}
              </div>
            </section>

            <WhatsAppConversationComposer
              conversationId={conversation.id}
              brandId={conversation.brand_id}
              leadId={conversation.lead_id}
              serviceWindowState={serviceWindowState}
              templates={workspace.templates.map((template) => ({
                id: template.id,
                template_name: template.template_name,
                language_code: template.language_code,
                category: template.category,
              }))}
            />
          </div>

          <aside className="grid content-start gap-4">
            {!conversation.lead_id ? (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h2 className="text-sm font-black text-amber-950">未配對 Lead</h2>
                <p className="mt-1 text-xs font-semibold leading-5 text-amber-900">
                  系統只會顯示同品牌、電話完全相符的候選；唔會自動建立重複 Lead。
                </p>
                <div className="mt-3 grid gap-2">
                  {candidates.length ? (
                    candidates.map((candidate) => (
                      <form
                        key={candidate.id}
                        action={linkConversationToLeadAction}
                        className="rounded-lg border border-amber-200 bg-white p-3"
                      >
                        <input type="hidden" name="conversationId" value={conversation.id} />
                        <input type="hidden" name="leadId" value={candidate.id} />
                        <p className="text-xs font-black text-[#111827]">
                          {candidate.contact?.name || candidate.contact?.phone || candidate.id}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
                          Lead 建立：{formatDateTime(candidate.created_at)}
                        </p>
                        <button className="mt-2 w-full rounded-lg bg-amber-950 px-3 py-2 text-xs font-black text-white">
                          確認配對此 Lead
                        </button>
                      </form>
                    ))
                  ) : (
                    <p className="rounded-lg bg-white p-3 text-xs font-semibold text-[#64748b]">
                      暫時無同品牌、電話完全相符的 Lead。請先在 CRM 手動建立或核對客人資料。
                    </p>
                  )}
                </div>
              </section>
            ) : (
              <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
                <h2 className="text-sm font-black text-[#111827]">CS 快捷操作</h2>
                <div className="mt-3 grid gap-2">
                  <Link
                    href={`/crm/leads/${conversation.lead_id}`}
                    className="rounded-lg border border-[#dbe2ea] px-3 py-2 text-center text-xs font-black text-[#334155]"
                  >
                    標記已聯絡 / 已預約 / 已流失
                  </Link>
                  <Link
                    href={`/crm/leads/${conversation.lead_id}#booking`}
                    className="rounded-lg border border-[#dbe2ea] px-3 py-2 text-center text-xs font-black text-[#334155]"
                  >
                    開啟預約資料
                  </Link>
                </div>
                <p className="mt-3 text-[11px] font-semibold leading-5 text-[#94a3b8]">
                  預約狀態沿用 CRM 現有確認流程；客人偏好日期時間唔會自動當作已預約。
                </p>
              </section>
            )}

            <section className="rounded-xl border border-[#e2e8f0] bg-white p-4">
              <h2 className="text-sm font-black text-[#111827]">內部備註</h2>
              <p className="mt-1 text-xs font-semibold text-[#64748b]">
                備註只寫入 CRM timeline，唔會發送俾客人。
              </p>
              <form action={addWhatsAppInternalNoteAction} className="mt-3 grid gap-2">
                <input type="hidden" name="conversationId" value={conversation.id} />
                <textarea
                  name="body"
                  rows={4}
                  required
                  placeholder="例如：客人要求星期五下午再聯絡"
                  className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
                <button className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white">
                  新增內部備註
                </button>
              </form>
            </section>
          </aside>
        </div>
      </main>
    </CrmShell>
  );
}

function ServiceWindowBadge({
  state,
}: {
  state: "open" | "template_required" | "unknown";
}) {
  const content = {
    open: ["可自由回覆", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    template_required: ["客服視窗已關閉 · Template required", "border-amber-200 bg-amber-50 text-amber-800"],
    unknown: ["首次聯絡 · Template required", "border-slate-200 bg-slate-50 text-slate-700"],
  } as const;
  const [label, className] = content[state];
  return (
    <span className={`rounded-full border px-3 py-2 text-xs font-black ${className}`}>
      {label}
    </span>
  );
}

function MessageStatus({ status }: { status: string | null }) {
  const normalized = status || "queued";
  const label =
    normalized === "read"
      ? "✓✓ Read"
      : normalized === "delivered"
        ? "✓✓ Delivered"
        : normalized === "failed"
          ? "Failed"
          : normalized;
  return (
    <span className={normalized === "failed" ? "text-red-600" : "text-[#64748b]"}>
      {label}
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
