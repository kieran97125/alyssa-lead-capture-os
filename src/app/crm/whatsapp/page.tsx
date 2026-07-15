import Link from "next/link";
import { CrmShell } from "@/components/crm/CrmShell";
import { getWhatsAppConnectionByBrandSlug } from "@/lib/crm/whatsapp";
import { getWhatsAppInbox } from "@/lib/crm/whatsappInbox";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WhatsAppInboxPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const brand = firstParam(query?.brand) || "ineffable";
  const filter = firstParam(query?.filter) || "all";
  const search = firstParam(query?.search) || "";
  const feedback = firstParam(query?.success) || firstParam(query?.error) || "";
  const connectionView = await getWhatsAppConnectionByBrandSlug(brand);
  const inbox = await getWhatsAppInbox({ brandSlug: brand, filter, search, limit: 150 });

  return (
    <CrmShell active="whatsapp">
      <main className="min-h-screen bg-[#f8fafc]">
        <header className="border-b border-[#e5e7eb] bg-white px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#7c3aed]">
                Ineffable Beauty
              </p>
              <h1 className="mt-1 text-2xl font-black text-[#111827]">
                WhatsApp Inbox
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                未讀優先、未配對訊息、客服視窗及 Template 發送集中管理。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={connectionView.connection ? "green" : "amber"}>
                {connectionView.statusLabel}
              </StatusPill>
              <StatusPill tone={inbox.tableReady ? "green" : "red"}>
                {inbox.tableReady ? "Inbox DB ready" : "Phase 2B SQL required"}
              </StatusPill>
              <Link
                href="/crm/whatsapp/templates"
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-black text-[#334155]"
              >
                Templates
              </Link>
              <Link
                href="/crm/settings/whatsapp"
                className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white"
              >
                連接設定
              </Link>
            </div>
          </div>
          {feedback ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
              {feedback}
            </div>
          ) : null}
        </header>

        <section className="border-b border-[#e5e7eb] bg-white px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <nav className="flex gap-2 overflow-x-auto">
              {[
                ["all", "全部"],
                ["unread", `未讀 ${inbox.unreadCount || ""}`],
                ["unmatched", "未配對"],
                ["matched", "已配對"],
                ["archived", "已封存"],
              ].map(([key, label]) => (
                <Link
                  key={key}
                  href={`/crm/whatsapp?brand=${encodeURIComponent(brand)}&filter=${key}`}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-black ${
                    filter === key
                      ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
                      : "border-[#e2e8f0] bg-white text-[#64748b]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <form className="flex min-w-0 gap-2">
              <input type="hidden" name="brand" value={brand} />
              <input type="hidden" name="filter" value={filter} />
              <input
                name="search"
                defaultValue={search}
                placeholder="搜尋電話、名稱、訊息…"
                className="h-9 min-w-0 flex-1 rounded-lg border border-[#dbe2ea] px-3 text-sm xl:w-[320px]"
              />
              <button className="h-9 rounded-lg border border-[#111827] px-3 text-xs font-black text-[#111827]">
                搜尋
              </button>
            </form>
          </div>
        </section>

        {!connectionView.connection ? (
          <section className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-5 lg:m-6">
            <h2 className="text-lg font-black text-amber-950">WhatsApp 尚未連接</h2>
            <p className="mt-2 text-sm font-semibold text-amber-900">
              Phase 2B Inbox 已準備好；請先完成 IB Meta WhatsApp Cloud API 連接。
            </p>
            <Link
              href="/crm/settings/whatsapp"
              className="mt-4 inline-flex rounded-lg bg-amber-950 px-4 py-2 text-sm font-black text-white"
            >
              開啟 WhatsApp 連接設定
            </Link>
          </section>
        ) : !inbox.tableReady ? (
          <section className="m-4 rounded-xl border border-red-200 bg-red-50 p-5 lg:m-6">
            <h2 className="text-lg font-black text-red-900">需要套用 Phase 2B SQL</h2>
            <p className="mt-2 text-sm font-semibold text-red-800">
              請 review 並套用 docs/CRM_WHATSAPP_PHASE2B_APPLY.sql，Inbox 先會開始儲存 conversation / unread 狀態。
            </p>
          </section>
        ) : (
          <section className="p-4 lg:p-6">
            <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
              {inbox.rows.length ? (
                <div className="divide-y divide-[#eef2f6]">
                  {inbox.rows.map((row) => (
                    <Link
                      key={row.id}
                      href={`/crm/whatsapp/${row.id}`}
                      className="grid gap-3 px-4 py-4 transition hover:bg-[#f8fafc] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_160px_130px] lg:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-black text-[#111827]">
                            {row.customer_name || row.customer_phone}
                          </span>
                          {row.unread_count > 0 ? (
                            <span className="grid min-w-5 place-items-center rounded-full bg-[#dc2626] px-1.5 py-0.5 text-[10px] font-black text-white">
                              {row.unread_count}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[#64748b]">
                          {row.customer_phone} · {row.lead_id ? "已配對 Lead" : "未配對"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#334155]">
                          {row.last_message_preview || "尚未有訊息內容"}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[#94a3b8]">
                          {row.needs_reply ? "客人待回覆" : "已回覆 / 等待客人"}
                        </p>
                      </div>
                      <div>
                        <ServiceWindowBadge state={row.service_window_state} />
                        <p className="mt-1 text-[11px] font-semibold text-[#94a3b8]">
                          CRM: {row.lead_status || "未配對"}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-[#64748b] lg:text-right">
                        {formatDateTime(row.last_message_at)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <p className="text-base font-black text-[#334155]">暫時未有對話</p>
                  <p className="mt-2 text-sm font-semibold text-[#94a3b8]">
                    連接 webhook 後，客人 inbound 訊息會自動出現喺呢度。
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </CrmShell>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "green" | "amber" | "red";
}) {
  const classes = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${classes[tone]}`}>
      {children}
    </span>
  );
}

function ServiceWindowBadge({
  state,
}: {
  state: "open" | "template_required" | "unknown";
}) {
  const labels = {
    open: ["可自由回覆", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    template_required: ["需要 Template", "border-amber-200 bg-amber-50 text-amber-800"],
    unknown: ["首次聯絡 Template", "border-slate-200 bg-slate-50 text-slate-600"],
  } as const;
  const [label, className] = labels[state];
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${className}`}>
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
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
