import Link from "next/link";
import { CrmShell } from "@/components/crm/CrmShell";
import { getWhatsAppConnectionByBrandSlug } from "@/lib/crm/whatsapp";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminEnv,
} from "@/lib/supabase/admin";
import { syncWhatsAppTemplatesAction } from "../actions";

export const dynamic = "force-dynamic";

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
              <h1 className="mt-2 text-2xl font-black text-[#111827]">
                WhatsApp Templates
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#64748b]">
                從 IB WABA 同步 Approved / Pending / Rejected Templates；唔會跨品牌混用。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/crm/settings/whatsapp"
                className="rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-black text-[#334155]"
              >
                Connection Settings
              </Link>
              <form action={syncWhatsAppTemplatesAction}>
                <input type="hidden" name="connectionId" value={connection?.id || ""} />
                <button
                  disabled={!connection}
                  className="rounded-lg bg-[#111827] px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  同步 Meta Templates
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

        <section className="border-b border-[#e5e7eb] bg-white px-4 py-3 lg:px-6">
          <nav className="flex gap-2 overflow-x-auto">
            {["ALL", "APPROVED", "PENDING", "REJECTED", "PAUSED", "DISABLED"].map(
              (status) => (
                <Link
                  key={status}
                  href={`/crm/whatsapp/templates?status=${status.toLowerCase()}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                    statusFilter === status
                      ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
                      : "border-[#e2e8f0] bg-white text-[#64748b]"
                  }`}
                >
                  {status}
                </Link>
              )
            )}
          </nav>
        </section>

        {!connection ? (
          <section className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-5 lg:m-6">
            <h2 className="text-lg font-black text-amber-950">尚未連接 IB WhatsApp</h2>
            <p className="mt-2 text-sm font-semibold text-amber-900">
              儲存 WABA ID、Access Token 同 App Secret 後先可以同步 Templates。
            </p>
          </section>
        ) : (
          <section className="p-4 lg:p-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.length ? (
                templates.map((template) => (
                  <article
                    key={template.id}
                    className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-black text-[#111827]">
                          {template.template_name}
                        </h2>
                        <p className="mt-1 text-xs font-semibold text-[#64748b]">
                          {template.language_code} · {template.category || "Uncategorised"}
                        </p>
                      </div>
                      <TemplateStatus status={template.status} stale={template.is_stale} />
                    </div>
                    <p className="mt-4 text-[11px] font-semibold text-[#94a3b8]">
                      Last sync: {formatDateTime(template.last_synced_at)}
                    </p>
                    <details className="mt-3 rounded-lg bg-[#f8fafc] p-3">
                      <summary className="cursor-pointer text-xs font-black text-[#475569]">
                        Components
                      </summary>
                      <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-[10px] text-[#64748b]">
                        {JSON.stringify(template.components || [], null, 2)}
                      </pre>
                    </details>
                  </article>
                ))
              ) : (
                <div className="col-span-full rounded-xl border border-dashed border-[#cbd5e1] bg-white p-10 text-center">
                  <p className="text-base font-black text-[#334155]">未有 Template 資料</p>
                  <p className="mt-2 text-sm font-semibold text-[#94a3b8]">
                    撳「同步 Meta Templates」讀取 WABA 內的現有 Templates。
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

async function loadTemplates(brandId: string, statusFilter: string) {
  if (!brandId || !hasSupabaseAdminEnv()) return [];
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false });
  if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
  const { data } = await query;
  return (data || []) as Array<{
    id: string;
    template_name: string;
    language_code: string;
    status: string;
    category: string | null;
    components: unknown;
    is_stale: boolean;
    last_synced_at: string | null;
  }>;
}

function TemplateStatus({ status, stale }: { status: string; stale: boolean }) {
  const approved = status === "APPROVED" && !stale;
  return (
    <span
      className={`rounded-full border px-2 py-1 text-[10px] font-black ${
        approved
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {stale ? "STALE" : status}
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
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
