import { getPrivateWorkbenchAccess } from "@/lib/workbench/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLeadDashboardSnapshot } from "@/lib/marketing/leadDashboard";
import { hongKongDate, type WorkbenchContext } from "@/lib/workbench/model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" };
  try {
    const { allowed, access } = await getPrivateWorkbenchAccess();
    if (!allowed) return Response.json({ message: "未獲授權讀取工作枱資料。" }, { status: 403, headers });
    const endDate = hongKongDate(); const startDate = `${endDate.slice(0, 7)}-01`;
    const db = createSupabaseAdminClient();
    const [performance, creative, tasks] = await Promise.allSettled([
      getLeadDashboardSnapshot({ startDate, endDate }, access),
      db.from("creative_jobs").select("id,title,status,due_date").is("deleted_at", null).order("updated_at", { ascending: false }).limit(80),
      db.from("marketing_work_tasks").select("id,title,status,due_date").order("updated_at", { ascending: false }).limit(80),
    ]);
    const p = performance.status === "fulfilled" && performance.value.live ? performance.value : null;
    const c = creative.status === "fulfilled" && !creative.value.error ? creative.value.data : null;
    const t = tasks.status === "fulfilled" && !tasks.value.error ? tasks.value.data : null;
    const snapshot: WorkbenchContext = {
      checkedAt: new Date().toISOString(), startDate, endDate,
      performance: { available: !!p, source: p?.sourceName ?? "已儲存 Lead Funnel", updatedAt: p?.loadedAt ?? null,
        warning: p ? p.warnings.join("；") : "已儲存 Lead 資料暫時未能讀取；可打開 Dashboard 核對。",
        accounts: p ? p.accountRows.map(row => ({ id: row.accountId, label: row.accountLabel, leads: row.leads, bookings: row.bookings, shows: row.shows })) : [] },
      creative: { available: c !== null, jobs: (c ?? []).map(j => ({ id: String(j.id), title: String(j.title), status: String(j.status), dueDate: String(j.due_date ?? ""), url: `/creative-jobs/${j.id}` })) },
      tasks: { available: t !== null, jobs: (t ?? []).map(j => ({ id: String(j.id), title: String(j.title), status: String(j.status), dueDate: String(j.due_date ?? ""), url: `/tasks?focus=${j.id}` })) },
    };
    return Response.json(snapshot, { headers });
  } catch { return Response.json({ message: "系統資料暫時未能讀取。" }, { status: 503, headers }); }
}
