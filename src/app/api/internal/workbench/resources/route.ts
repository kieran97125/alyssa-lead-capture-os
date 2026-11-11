import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPrivateWorkbenchAccess, workbenchMutationOriginAllowed } from "@/lib/workbench/server";
import { driveFileId, resourceKinds } from "@/lib/workbench/resources";
import { driveToken, getDriveFile } from "@/lib/workbench/drive";
import { runResourceSync } from "@/lib/workbench/resourceSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
export async function GET(request: Request) {
  try {
    const { allowed, ownerId } = await getPrivateWorkbenchAccess();
    if (!allowed || !ownerId) return reply({ message: "未獲授權讀取私人檔案。" }, 403);
    const db = createSupabaseAdminClient(); const url = new URL(request.url); const p = url.searchParams;
    if (p.get("overview") === "1") {
      const result = await db.rpc("workbench_resource_overview", { p_owner: ownerId });
      if (result.error) throw result.error;
      return reply({ ...result.data, automatic: !!process.env.WORKBENCH_SYNC_SECRET });
    }
    const source = p.get("source"), parent = p.get("folder"); const kind = p.get("kind") || "all";
    if (source && !uuid(source) || parent && !/^[A-Za-z0-9_-]{10,200}$/.test(parent) || !resourceKinds.includes(kind as typeof resourceKinds[number])) return reply({ message: "搜尋條件無效。" }, 400);
    const result = await db.rpc("workbench_resource_search", { p_owner: ownerId, p_query: (p.get("q") || "").slice(0, 120), p_node: (p.get("node") || "").slice(0, 100), p_source: source || null, p_kind: kind, p_parent: parent || null, p_page: Math.max(0, Math.min(10000, Number(p.get("page")) || 0)) });
    if (result.error) throw result.error;
    return reply(result.data);
  } catch (error) { console.error("workbench_resources_read_failed", { code: (error as { code?: string })?.code || "unknown" }); return reply({ message: "檔案索引暫時未能讀取，原有星圖同 Jobs 仍可使用。" }, 503); }
}
export async function POST(request: Request) {
  try {
    const { allowed, ownerId } = await getPrivateWorkbenchAccess();
    if (!allowed || !ownerId) return reply({ message: "未獲授權更新私人資料來源。" }, 403);
    if (!workbenchMutationOriginAllowed(request)) return reply({ message: "請由工作枱內更新資料來源。" }, 403);
    const raw = await request.text(); if (raw.length > 12000) return reply({ message: "來源設定過大。" }, 413);
    let body; try { body = JSON.parse(raw); } catch { return reply({ message: "來源格式無效。" }, 400); }
    const db = createSupabaseAdminClient();
    if (body.action === "sync") {
      if (body.sourceId && !uuid(body.sourceId)) return reply({ message: "來源無效。" }, 400);
      let update = db.from("workbench_resource_sources").update({ next_sync_at: new Date().toISOString(), status: "queued" }).eq("owner_member_id", ownerId).eq("enabled", true).or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`);
      if (body.sourceId) update = update.eq("id", body.sourceId);
      const queued = await update; if (queued.error) throw queued.error;
      return reply({ results: await runResourceSync(ownerId, body.sourceId) });
    }
    if (body.action === "continue") return reply({ results: await runResourceSync(ownerId) });
    if (body.action === "toggle") {
      if (!uuid(body.sourceId) || typeof body.enabled !== "boolean") return reply({ message: "來源設定無效。" }, 400);
      const updated = await db.from("workbench_resource_sources").update({ enabled: body.enabled, ...(body.enabled ? { next_sync_at: new Date().toISOString(), status: "queued", cursor: {} } : {}) }).eq("owner_member_id", ownerId).eq("id", body.sourceId).or(`lease_until.is.null,lease_until.lt.${new Date().toISOString()}`).select("id").maybeSingle();
      if (updated.error) throw updated.error;
      if (!updated.data) return reply({ message: "來源正在同步，請稍後再調整。" }, 409);
      return reply({ ok: true });
    }
    if (body.action === "add") {
      const fileId = driveFileId(String(body.url || ""));
      if (!fileId || !Array.isArray(body.nodeIds) || body.nodeIds.length > 30 || !body.nodeIds.every((v: unknown) => typeof v === "string") || !["metadata", "documents"].includes(body.contentMode)) return reply({ message: "請填寫有效 Google Drive 連結同所屬星球。" }, 400);
      const doc = await db.from("personal_workbenches").select("document").eq("owner_member_id", ownerId).single();
      const validIds = new Set((doc.data?.document?.nodes ?? []).filter((n: { archived: boolean }) => !n.archived).map((n: { id: string }) => n.id));
      if (!body.nodeIds.length || !body.nodeIds.every((id: string) => validIds.has(id))) return reply({ message: "請選擇現有星球。" }, 400);
      const count = await db.from("workbench_resource_sources").select("id", { count: "exact", head: true }).eq("owner_member_id", ownerId);
      if ((count.count ?? 0) >= 30) return reply({ message: "最多可設定 30 個來源，請先整理已有來源。" }, 400);
      const file = await getDriveFile(await driveToken(), fileId); if (file.trashed) return reply({ message: "呢份資料已移到垃圾桶。" }, 400);
      const inserted = await db.from("workbench_resource_sources").insert({ owner_member_id: ownerId, drive_file_id: file.id, label: (String(body.label || "").trim() || file.name).slice(0, 160), kind: file.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file", node_ids: [...new Set(body.nodeIds)], content_mode: body.contentMode }).select("id").single();
      if (inserted.error?.code === "23505") return reply({ message: "呢個來源已經加入，可以直接同步或重新啟用。" }, 409);
      if (inserted.error) throw inserted.error;
      return reply({ ok: true, id: inserted.data.id });
    }
    return reply({ message: "未知操作。" }, 400);
  } catch (error) {
    console.error("workbench_resources_write_failed", { code: (error as { code?: string })?.code || "provider" });
    return reply({ message: "同步暫時未能完成，已有索引同進度仍保留。請核對 Google 連接或稍後重試。" }, 503);
  }
}
