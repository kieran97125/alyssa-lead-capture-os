import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPrivateWorkbenchAccess, workbenchMutationOriginAllowed } from "@/lib/workbench/server";
import { createWorkbenchTemplate, validateWorkbenchDocument } from "@/lib/workbench/model";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

export async function GET() {
  try {
    const { allowed, ownerId } = await getPrivateWorkbenchAccess();
    if (!allowed || !ownerId) return reply({ message: "未獲授權使用私人工作枱。" }, 403);
    const db = createSupabaseAdminClient();
    let result = await db.from("personal_workbenches").select("document,revision,updated_at").eq("owner_member_id", ownerId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) {
      const seed = await db.from("personal_workbenches").upsert({ owner_member_id: ownerId, document: createWorkbenchTemplate() }, { onConflict: "owner_member_id", ignoreDuplicates: true });
      if (seed.error) throw seed.error;
      result = await db.from("personal_workbenches").select("document,revision,updated_at").eq("owner_member_id", ownerId).single();
    }
    if (result.error || !result.data || !validateWorkbenchDocument(result.data.document)) throw new Error("invalid_workbench_record");
    return reply({ document: result.data.document, revision: result.data.revision, updatedAt: result.data.updated_at });
  } catch { return reply({ message: "工作枱暫時未能讀取，請稍後重試。" }, 503); }
}

export async function PUT(request: Request) {
  try {
    const { allowed, ownerId } = await getPrivateWorkbenchAccess();
    if (!allowed || !ownerId) return reply({ message: "未獲授權更新私人工作枱。" }, 403);
    if (!workbenchMutationOriginAllowed(request)) return reply({ message: "請由系統內儲存工作枱。" }, 403);
    const raw = await request.text();
    if (raw.length > 900000) return reply({ message: "工作枱內容過大，請先匯出及整理。" }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ message: "工作枱格式無效。" }, 400); }
    if (!Number.isSafeInteger(body.revision) || body.revision < 1 || !validateWorkbenchDocument(body.document)) return reply({ message: "工作枱資料未通過檢查，尚未儲存。" }, 400);
    const updatedAt = new Date().toISOString();
    const { data, error } = await createSupabaseAdminClient().from("personal_workbenches")
      .update({ document: body.document, revision: body.revision + 1, updated_at: updatedAt })
      .eq("owner_member_id", ownerId).eq("revision", body.revision).select("revision,updated_at").maybeSingle();
    if (error) throw error;
    if (!data) return reply({ message: "另一個視窗已更新工作枱。請先匯出目前內容，再重新載入。" }, 409);
    return reply({ revision: data.revision, updatedAt: data.updated_at });
  } catch { return reply({ message: "未能儲存，內容仍保留喺目前視窗。請重試。" }, 503); }
}
