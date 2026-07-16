import Link from "next/link";
import { CrmShell } from "@/components/crm/CrmShell";
import { getWhatsAppConnectionByBrandSlug } from "@/lib/crm/whatsapp";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { syncWhatsAppTemplatesAction } from "../actions";

export const dynamic = "force-dynamic";

const ibTemplateBlueprints = [
  {
    name: "ib_first_contact",
    title: "首次聯絡",
    category: "MARKETING / UTILITY",
    body: "你好 {{1}}，多謝你登記 Ineffable Beauty 的 {{2}}。我是預約專員，想跟你確認想預約的分店及時間。你可以直接回覆方便的日期和時段，我們會盡快為你安排。",
    variables: "{{1}} 客人稱呼 · {{2}} 療程名稱",
    use: "網站新 Lead 首次主動聯絡；未有 24 小時客服視窗時使用。",
  },
  {
    name: "ib_booking_confirmation",
    title: "預約確認",
    category: "UTILITY",
    body: "你好 {{1}}，你的 Ineffable Beauty 預約已確認：\n療程：{{2}}\n日期：{{3}}\n時間：{{4}}\n分店：{{5}}\n如需更改，請直接回覆此訊息通知我們。",
    variables: "{{1}} 客人稱呼 · {{2}} 療程 · {{3}} 日期 · {{4}} 時間 · {{5}} 分店",
    use: "CS 完成正式預約後發送；客人偏好時間不可當作已確認預約。",
  },
  {
    name: "ib_booking_reminder",
    title: "預約提醒",
    category: "UTILITY",
    body: "你好 {{1}}，溫馨提示你已預約 Ineffable Beauty：\n療程：{{2}}\n日期：{{3}}\n時間：{{4}}\n分店：{{5}}\n如未能出席或需要更改時間，請盡早回覆通知我們。期待見到你。",
    variables: "{{1}} 客人稱呼 · {{2}} 療程 · {{3}} 日期 · {{4}} 時間 · {{5}} 分店",
    use: "預約前一日或指定提醒時間，由 CS 確認後發送。",
  },
];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WhatsAppTemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const statusFilter = (firstParam(query?.status) || "all").toUpperCase();
  const feedback = firstParam(query?.success) || firstParam(query?.error) || "";
  const connectionView = await getWhatsAppConnectionByBrandSlug("ineffable");
  const connection = connectionView.connection;
  const templates = await loadTemplates(connection?.brand_id || "", statusFilter);

  return (
    <CrmShell active="whatsapp">
      <main className="min-h-screen bg-[#f8fafc]">
        <header className="border-b border-[#e5e7eb] bg-white px-4 py-4 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link href="/crm/whatsapp" className="text-xs font-black text-[#6366f1]">
                ← WhatsApp Inbox
              </Link>
              <h1 className="mt-2 text-2xl font-black text-[#111827]">IB WhatsApp Templates</h1>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                先準備 Meta 審批內容；連接 WABA 後再同步 Approved / Pending / Rejected 狀態。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/crm/settings/whatsapp" className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-black text-[#334155]">
                Connection Settings
              </Link>
              <form action={syncWhatsAppTemplatesAction}>
                <input type="hidden" name="connectionId" value={connection?.id || ""} />
                <button disabled={!connection} className="rounded-lg bg-[#111827] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                  同步 Meta Templates
                </button>
              </form>
            </div>
          </div>
          {feedback ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{feedback}</div> : null}
        </header>

        <section className="px-4 py-5 lg:px-6">
          <div className="mb-5 rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] p-4">
            <p className="text-sm font-black text-[#312e81]">Meta 審批前準備</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#4f46e5]">
              以下三款係 IB 建議模板藍本。未連接 WhatsApp API 前已可交老闆審批文案；之後需在 Meta WhatsApp Manager 建立並獲批，先可以由 CRM 正式發送。
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {ibTemplateBlueprints.map((item) => (
              <article key={item.name} className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6366f1]">{item.name}</p>
                    <h2 className="mt-1 text-lg font-black text-[#111827]">{item.title}</h2>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800">待 Meta 建立</span>
                </div>
                <p className="mt-3 text-xs font-black text-[#64748b]">{item.category}</p>
                <div className="mt-4 whitespace-pre-line rounded-xl bg-[#f8fafc] p-4 text-sm font-semibold leading-6 text-[#334155]">{item.body}</div>
                <dl className="mt-4 grid gap-3 text-xs">
                  <div><dt className="font-black text-[#475569]">變數</dt><dd className="mt-1 font-semibold leading-5 text-[#64748b]">{item.variables}</dd></div>
                  <div><dt className="font-black text-[#475569]">用途</dt><dd className="mt-1 font-semibold leading-5 text-[#64748b]">{item.use}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#e5e7eb] bg-white px-4 py-3 lg:px-6">
          <nav className="flex gap-2 overflow-x-auto">
            {["ALL", "APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"].map((status) => (
              <Link key={status} href={`/crm/whatsapp/templates?status=${status.toLowerCase()}`} className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusFilter === status ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]" : "border-[#e2e8f0] bg-white text-[#64748b]"}`}>
                {status}
              </Link>
            ))}
          </nav>
        </section>

        {!connection ? (
          <section className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-5 lg:m-6">
            <h2 className="text-lg font-black text-amber-950">尚未連接 IB WhatsApp</h2>
            <p className="mt-2 text-sm font-semibold text-amber-900">藍本已準備好。老闆批准接駁後，儲存 WABA ID、Access Token 同 App Secret，再到 Meta 建立模板並返回同步。</p>
          </section>
        ) : (
          <section className="p-4 lg:p-6">
            <h2 className="mb-3 text-lg font-black text-[#111827]">Meta 已同步 Templates</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.length ? templates.map((template) => (
                <article key={template.id} className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h3 className="truncate text-sm font-black text-[#111827]">{template.template_name}</h3><p className="mt-1 text-xs font-semibold text-[#64748b]">{template.language_code} · {template.category || "Uncategorised"}</p></div>
                    <TemplateStatus status={template.status} stale={template.is_stale} />
                  </div>
                  <p className="mt-4 text-[11px] font-semibold text-[#94a3b8]">Last sync: {formatDateTime(template.last_synced_at)}</p>
                </article>
              )) : <div className="col-span-full rounded-xl border border-dashed border-[#cbd5e1] bg-white p-8 text-center"><p className="font-black text-[#334155]">WABA 暫未有同步資料</p></div>}
            </div>
          </section>
        )}
      </main>
    </CrmShell>
  );
}

async function loadTemplates(brandId: string, statusFilter: string) {
  if (!brandId || !hasSupabaseAdminEnv()) return [];
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("whatsapp_templates").select("*").eq("brand_id", brandId).order("updated_at", { ascending: false });
  if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
  const { data } = await query;
  return (data || []) as Array<{ id: string; template_name: string; language_code: string; status: string; category: string | null; is_stale: boolean; last_synced_at: string | null }>;
}

function TemplateStatus({ status, stale }: { status: string; stale: boolean }) {
  const approved = status === "APPROVED" && !stale;
  return <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${approved ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{stale ? "STALE" : status}</span>;
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
