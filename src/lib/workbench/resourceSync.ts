import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { driveToken, DriveReadError, getDriveFile, listDriveFolder, readDriveText, type DriveFile } from "./drive";
import { contentIndexable, resourceNodes, safeDriveUrl, type FolderBinding } from "./resources";

type Folder = { id: string; path: string; ancestors: string[]; pageToken?: string };
type Cursor = { generation: string; phase: "listing" | "content"; queue: Folder[]; visited: string[]; errors: string[]; rootRead: boolean };
type Source = { id: string; owner_member_id: string; drive_file_id: string; label: string; kind: "folder" | "file"; node_ids: string[]; folder_bindings: FolderBinding[]; content_mode: string; cursor: Partial<Cursor>; lease_token: string };
export function freshResourceCursor(): Cursor { return { generation: crypto.randomUUID(), phase: "listing", queue: [], visited: [], errors: [], rootRead: false }; }
export function resourceFileRows(file: DriveFile, source: Source, path: string, ancestors: string[], parent: string | null) {
  const version = `${file.modifiedTime ?? ""}:${file.size ?? ""}`;
  return {
    file: { file_id: file.id, name: file.name.slice(0, 600), mime_type: file.mimeType, web_url: safeDriveUrl(file.id, file.mimeType), modified_time: file.modifiedTime ?? null, size: file.size && /^\d+$/.test(file.size) ? Number(file.size) : null, description: (file.description ?? "").slice(0, 2000), has_thumbnail: !!file.hasThumbnail, content_version: version, indexable: source.content_mode === "documents" && contentIndexable(file.mimeType) },
    mount: { file_id: file.id, parent_id: parent, path: path.slice(0, 8000), node_ids: resourceNodes(source.node_ids, source.folder_bindings, [...ancestors, file.id]) },
  };
}
function message(error: unknown) { return error instanceof DriveReadError ? error.message : error instanceof Error && /索引|頁|檔案|Google|資料夾/.test(error.message) ? error.message.slice(0, 240) : "同步暫時中斷，已保留進度，稍後會繼續。"; }

async function step(source: Source, token: string, deadline: number) {
  const db = createSupabaseAdminClient();
  const cursor: Cursor = source.cursor.generation ? structuredClone(source.cursor as Cursor) : freshResourceCursor();
  let files: unknown[] = [], mounts: unknown[] = [], texts: unknown[] = [];
  let prune = false, complete = false, hide = false;
  let status = "queued", error = "";
  const record = (file: DriveFile, path: string, ancestors: string[], parent: string | null) => { const row = resourceFileRows(file, source, path, ancestors, parent); files.push(row.file); mounts.push(row.mount); };
  try {
    if (!cursor.rootRead) {
      const root = await getDriveFile(token, source.drive_file_id);
      if (root.trashed) throw new DriveReadError(404);
      if (source.kind === "folder" && root.mimeType !== "application/vnd.google-apps.folder") throw new Error("來源類型已改變，請重新加入資料夾。");
      record(root, root.name, [], null); cursor.rootRead = true;
      if (source.kind === "folder") { cursor.queue = [{ id: root.id, path: root.name, ancestors: [root.id] }]; cursor.visited = [root.id]; }
      else { cursor.phase = "content"; prune = true; }
    }
    if (cursor.phase === "listing") {
      for (let page = 0; page < 4 && cursor.queue.length && Date.now() < deadline - 14000; page++) {
        const folder = cursor.queue[0];
        try {
          const result = await listDriveFolder(token, folder.id, folder.pageToken);
          for (const file of result.files) {
            record(file, `${folder.path}/${file.name}`, folder.ancestors, folder.id);
            if (file.mimeType === "application/vnd.google-apps.folder" && !cursor.visited.includes(file.id)) {
              if (cursor.visited.length >= 10000) throw new Error("資料夾數量超過單一來源上限，請拆分來源後繼續。");
              cursor.visited.push(file.id); cursor.queue.push({ id: file.id, path: `${folder.path}/${file.name}`, ancestors: [...folder.ancestors, file.id] });
            }
          }
          if (result.nextPageToken) folder.pageToken = result.nextPageToken; else cursor.queue.shift();
        } catch (e) {
          if (folder.id !== source.drive_file_id && e instanceof DriveReadError && [403, 404].includes(e.status)) { cursor.errors.push(`${folder.path}：未能存取`); cursor.queue.shift(); }
          else throw e;
        }
      }
      if (!cursor.queue.length) { cursor.phase = "content"; prune = true; }
    }
    // Commit traversal before text queries: a resumed worker sees its own canonical files.
    if (cursor.phase === "content" && !files.length && Date.now() < deadline - 14000) {
      const pending = await db.from("workbench_resource_mounts").select("file_id,workbench_resource_files!inner(file_id,mime_type,size,content_version,text_state)").eq("owner_member_id", source.owner_member_id).eq("source_id", source.id).eq("generation", cursor.generation).eq("workbench_resource_files.text_state", "pending").limit(3);
      if (pending.error) throw pending.error;
      for (const row of pending.data ?? []) {
        if (Date.now() > deadline - 14000) break;
        const f = (Array.isArray(row.workbench_resource_files) ? row.workbench_resource_files[0] : row.workbench_resource_files) as { file_id: string; mime_type: string; size: number | null; content_version: string };
        try {
          const content = await readDriveText(token, { id: f.file_id, mimeType: f.mime_type, size: f.size?.toString() });
          texts.push({ file_id: f.file_id, content_version: f.content_version, text_content: content.text, text_state: content.state, text_error: "" });
        } catch (e) {
          if (e instanceof DriveReadError && [401, 429].includes(e.status)) throw e;
          texts.push({ file_id: f.file_id, content_version: f.content_version, text_content: "", text_state: "unavailable", text_error: message(e), ...(e instanceof DriveReadError && [403, 404].includes(e.status) ? { available: false } : {}) });
        }
      }
      if (!pending.data?.length) { complete = true; status = cursor.errors.length ? "partial" : "ready"; error = cursor.errors.slice(0, 5).join("；"); }
    }
  } catch (e) {
    status = e instanceof DriveReadError && e.status === 401 ? "auth_required" : "error"; error = message(e);
    hide = e instanceof DriveReadError && [403, 404].includes(e.status) && (!cursor.rootRead || cursor.queue[0]?.id === source.drive_file_id);
    // A completed page is safe to checkpoint; a failed page is retried from its token.
  }
  // Upserts are idempotent even when a provider page has to be retried.
  files = [...new Map(files.map(f => [(f as { file_id: string }).file_id, f])).values()];
  mounts = [...new Map(mounts.map(f => [(f as { file_id: string }).file_id, f])).values()];
  const result = await db.rpc("workbench_resource_commit", { p_owner: source.owner_member_id, p_source: source.id, p_lease: source.lease_token, p_files: files, p_mounts: mounts, p_texts: texts, p_cursor: cursor, p_status: status, p_error: error, p_prune: prune, p_complete: complete, p_hide: hide });
  if (result.error) throw result.error;
  return { committed: result.data === true, status, sourceId: source.id };
}

export async function runResourceSync(owner: string, sourceId?: string) {
  const db = createSupabaseAdminClient();
  let token: string;
  try { token = await driveToken(AbortSignal.timeout(12000)); }
  catch {
    await db.from("workbench_resource_sources").update({ status: "auth_required", last_error: "Google 連接需要檢查；已有資料仍保留，請由報告頁核對連接。", next_sync_at: new Date(Date.now() + 15 * 60000).toISOString() }).eq("owner_member_id", owner).eq("enabled", true);
    throw new Error("Google 連接需要檢查，請由報告頁核對。");
  }
  let query = db.from("workbench_resource_sources").select("id").eq("owner_member_id", owner).eq("enabled", true).lte("next_sync_at", new Date().toISOString()).order("next_sync_at").limit(3);
  if (sourceId) query = query.eq("id", sourceId);
  const sources = await query; if (sources.error) throw sources.error;
  const deadline = Date.now() + 45000; const results = [];
  for (const source of sources.data ?? []) {
    if (Date.now() > deadline - 14000) break;
    const claim = await db.rpc("workbench_resource_claim", { p_owner: owner, p_source: source.id });
    if (claim.error) throw claim.error;
    if (!claim.data) continue;
    results.push(await step(claim.data as Source, token, deadline));
  }
  return results;
}
