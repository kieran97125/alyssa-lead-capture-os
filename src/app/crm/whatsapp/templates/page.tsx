import Link from "next/link";
import { CrmShell } from "@/components/crm/CrmShell";
import { getWhatsAppConnectionByBrandSlug } from "@/lib/crm/whatsapp";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { syncWhatsAppTemplatesAction } from "../actions";

export const dynamic = "force-dynamic";

const blueprints = [
  {
    name: "ib_first_contact",
    title: "首次聯絡",
    body: "你好 {{1}}，多謝你登記 Ineffable Beauty 的 {{2}}。我是預約專員，想跟你確認想預約的分店及時間。你可以直接回覆方便的日期和時段，我們會盡快為你安排。",
  },
  {
    name: "ib_booking_confirmation",
    title: "預約確認",
    body: "你好 {{1}}，你的 Ineffable Beauty 預約已確認：\n療程：{{2}}\n日期：{{3}}\n時間：{{4}}\n分店：{{5}}\n如需更改，請直接回覆此訊息通知我們。",
  },
  {
    name: "ib_booking_reminder",
    title: "預約提醒",
    body: "你好 {{1}}，溫馨提示你已預約 Ineffable Beauty：\n療程：{{2}}\n日期：{{3}}\n時間：{{4}}\n分店：{{5}}\n如未能出席或需要更改時間，請盡早回覆通知我們。",
  },
] as const;

export default async function WhatsAppTemplatesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const feedback = first(query?.success) || first(query?.error) || "";
  const connectionView = await getWhatsAppConnectionByBrandSlug("ineffable");
  const connection = connectionView.connection;
  const templates = await loadTemplates(connection?.brand_id || "");

  return (
    <CrmShell active="settings">
      <main className="min-h-screen bg-[#f6f8fb]">
        <header className="border-b border-[#e5e7eb] bg-white px-4 py-4 lg:px-6">
          <Link href="/crm/settings" className="text-xs font-black text-[#6366f1]">← 返回設定</Link>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black text-[#111827]">WhatsApp 訊息範本</h1>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">三款日常訊息已準備好。</p>
            </div>
            <form action={syncWhatsAppTemplatesAction}>
              <input type="hidden" name="connectionId" value={connection?.id || ""} />
              <button disabled={!connection} className="h-9 rounded-lg bg-[#111827] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                從 Meta 更新狀態
              </button>
            </form>
          </div>
          {feedback ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">{feedback}</div> : null}
        </header>

        <section className="mx-auto max-w-5xl p-4 lg:p-6">
          {!connection ? (
            <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold text-amber-900">先完成 WhatsApp 連接，之後就可以同步 Meta 審批狀態。</p>
              <Link href="/crm/settings/whatsapp" className="text-xs font-black text-amber-950 underline">前往連接</Link>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            {blueprints.map((item) => {
              const synced = templates.find((template) => template.template_name === item.name);
              return (
                <details key={item.name} className="border-b border-[#eef2f7] last:border-0">
                  <summary className="grid cursor-pointer gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center">
                    <div className="min-w-0">
                      <h2 className="text-sm font-black text-[#111827]">{item.title}</h2>
                      <p className="mt-0.5 truncate text-xs font-semibold text-[#64748b]">{item.name}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-black sm:justify-self-end ${synced?.status === "APPROVED" && !synced.is_stale ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                      {synced ? statusLabel(synced.status, synced.is_stale) : "待 Meta 建立"}
                    </span>
                  </summary>
                  <div className="border-t border-[#eef2f7] bg-[#f8fafc] px-4 py-3">
                    <p className="whitespace-pre-line text-sm font-semibold leading-6 text-[#334155]">{item.body}</p>
                  </div>
                </details>
              );
            })}
          </div>

          <p className="mt-4 text-xs font-semibold text-[#94a3b8]">
            模板需要先在 Meta WhatsApp Manager 建立並獲批，CRM 才可以正式使用。
          </p>
        </section>
      </main>
    </CrmShell>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadTemplates(brandId: string) {
  if (!brandId || !hasSupabaseAdminEnv()) return [];
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("id,template_name,status,is_stale")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false });
  return (data || []) as Array<{ id: string; template_name: string; status: string; is_stale: boolean }>;
}

function statusLabel(status: string, stale: boolean) {
  if (stale) return "需要更新";
  if (status === "APPROVED") return "已批准";
  if (status === "PENDING") return "審批中";
  if (status === "REJECTED") return "未獲批准";
  return status;
}
