"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ArrowUpRight, ChevronRight, FileText, Folder, Film, Image as ImageIcon, Link2, LoaderCircle, Plus, RefreshCw, Search, X } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { driveFileId, resourceKind, resourceKinds, resourceTypeLabels, type ResourceOverview, type ResourceResult, type ResourceSource, type WorkResource } from "@/lib/workbench/resources";
import type { Planet } from "@/lib/workbench/model";
import styles from "./ResourceLibrary.module.css";

const endpoint = "/api/internal/workbench/resources";
const statusLabels = { queued: "等待接續", syncing: "同步中", ready: "已核對", partial: "部分需檢查", error: "稍後重試", auth_required: "需要授權" };
const time = (value: string | null) => value ? new Intl.DateTimeFormat("zh-HK", { timeZone: "Asia/Hong_Kong", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "首次收錄中";
const emptyResult: ResourceResult = { files: [], total: 0, page: 0, pageSize: 40 };
const fixtureSource: ResourceSource = { id: "11111111-1111-4111-8111-111111111111", label: "設計與素材", driveFileId: "fixture-source-folder", kind: "folder", nodeIds: ["creative", "ib"], enabled: true, contentMode: "documents", status: "ready", fileCount: 6, lastSyncedAt: "2026-11-11T03:00:00Z", lastError: "", updatedAt: "2026-11-11T03:00:00Z" };
const fixtureFiles: WorkResource[] = [
  ["file-brief", "肩頸護理｜拍攝 Brief", "application/vnd.google-apps.document", "設計與素材/IB/拍攝", "拍攝先展示肩頸放鬆過程，再交代護理重點。"],
  ["file-video", "護理過程｜剪輯版本 02.mp4", "video/mp4", "設計與素材/IB/成品", ""],
  ["file-poster", "十一月推廣｜主視覺.png", "image/png", "設計與素材/IB/meta_FEED", ""],
  ["file-sheet", "Designer 工作指派表", "application/vnd.google-apps.spreadsheet", "工作管理/設計派工", ""],
  ["file-slide", "每周工作進度", "application/vnd.google-apps.presentation", "工作管理/每周簡報", "本周 Creative 拍攝方向與工作進度。"],
  ["folder-material", "拍攝素材", "application/vnd.google-apps.folder", "設計與素材/IB/拍攝素材", ""],
].map(([id, name, mimeType, path, snippet]) => ({ id, name, mimeType, paths: [path], snippet, url: "/creative-jobs", modifiedAt: "2026-11-11T02:00:00Z", size: null, hasThumbnail: false, textState: snippet ? "indexed" : "metadata", nodeIds: ["creative", "ib"], sourceIds: [fixtureSource.id] }));
function FileIcon({ mime }: { mime: string }) { const kind = resourceKind(mime); const Icon = kind === "folder" ? Folder : kind === "image" ? ImageIcon : kind === "video" ? Film : FileText; return <Icon size={21} />; }

export function ResourceLibrary({ nodes, nodeId = "", compact = false, fixtureMode = false, onBrowse, onCreateJob }: { nodes: Planet[]; nodeId?: string; compact?: boolean; fixtureMode?: boolean; onBrowse?: () => void; onCreateJob: (file: WorkResource) => void }) {
  const [overview, setOverview] = useState<ResourceOverview | null>(null);
  const [result, setResult] = useState<ResourceResult>(emptyResult);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [kind, setKind] = useState("all"), [source, setSource] = useState(""), [planet, setPlanet] = useState(nodeId), [page, setPage] = useState(0);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]), [epoch, setEpoch] = useState(0), [adding, setAdding] = useState(false);
  const [fixtureSources, setFixtureSources] = useState([fixtureSource]);
  const pending = overview?.sources.some(s => s.enabled && ["queued", "syncing"].includes(s.status));
  const active = useRef(true), inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setPlanet(nodeId); setPage(0); setFolders([]); }, [nodeId]);
  const refreshOverview = useCallback(async () => {
    if (fixtureMode) { setOverview({ sources: fixtureSources, total: fixtureFiles.length, indexed: 2, pending: 0, checkedAt: "2026-11-11T03:00:00Z", automatic: true }); return; }
    const response = await fetch(`${endpoint}?overview=1`, { cache: "no-store" }); const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    if (active.current) setOverview(data);
  }, [fixtureMode, fixtureSources]);
  useEffect(() => { void refreshOverview().catch(e => { if (active.current) setError(e.message); }); }, [refreshOverview, epoch]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const effectiveNode = compact ? nodeId : planet;
        if (fixtureMode) {
          const files = fixtureSources.some(s => s.enabled) ? fixtureFiles.filter(f => (!effectiveNode || effectiveNode === "core" || f.nodeIds.includes(effectiveNode)) && (kind === "all" || resourceKind(f.mimeType) === kind) && (!query || `${f.name} ${f.paths.join(" ")} ${f.snippet}`.toLowerCase().includes(query.toLowerCase()))) : [];
          if (!controller.signal.aborted) setResult({ ...emptyResult, files, total: files.length }); return;
        }
        const params = new URLSearchParams({ q: query, node: effectiveNode, kind, page: String(page) });
        if (source) params.set("source", source); if (folders.length) params.set("folder", folders.at(-1)!.id);
        const response = await fetch(`${endpoint}?${params}`, { cache: "no-store", signal: controller.signal }); const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!controller.signal.aborted) { setResult(data); setError(""); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "檔案暫時未能讀取。"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, planet, nodeId, compact, source, kind, page, folders, epoch, fixtureMode, fixtureSources]);
  const mutate = useCallback(async (body: Record<string, unknown>) => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError("");
    try {
      if (fixtureMode) {
        if (body.action === "toggle") setFixtureSources(old => old.map(s => s.id === body.sourceId ? { ...s, enabled: !!body.enabled } : s));
        if (body.action === "add") setFixtureSources(old => [...old, { ...fixtureSource, id: crypto.randomUUID(), label: String(body.label || "新增工作來源"), nodeIds: body.nodeIds as string[] }]);
      } else {
        const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json();
        if (!response.ok) throw new Error(data.message);
      }
      if (active.current) { setEpoch(v => v + 1); return true; }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "更新暫時未能完成。"); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  }, [fixtureMode]);
  useEffect(() => {
    if (fixtureMode || compact || !pending || busy) return;
    const timer = setTimeout(() => { if (!document.hidden) void mutate({ action: "continue" }); else setEpoch(v => v + 1); }, 5000);
    return () => clearTimeout(timer);
  }, [pending, busy, fixtureMode, compact, mutate, epoch]);
  const reset = () => { setPage(0); setFolders([]); };
  const files = compact ? result.files.slice(0, 5) : result.files;

  return <section className={`${styles.library} ${compact ? styles.compact : ""}`} aria-label={compact ? "星球相關檔案" : "工作檔案資料庫"} data-testid={compact ? "planet-resources" : "resource-library"}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>CONNECTED WORK / FILES</span><h2>{compact ? "相關檔案" : "工作資料，都喺同一個軌道。"}</h2>{!compact ? <p>按星球、資料夾或文字尋找 Brief、素材、成品同管理文件。</p> : null}</div>
      {compact ? <SystemButton density="compact" variant="ghost" onClick={onBrowse}>全部<ChevronRight size={14} /></SystemButton> : <div className={styles.actions}><SystemButton density="compact" variant="outline" disabled={busy} onClick={() => void mutate({ action: "sync" })}><RefreshCw size={14} className={busy ? styles.spin : ""} />{busy ? "正在同步" : "同步全部"}</SystemButton><SystemButton density="compact" onClick={() => setAdding(true)}><Plus size={14} />加入來源</SystemButton></div>}
    </div>
    {!compact ? <>
      <div className={styles.metrics}><div><strong>{overview?.total ?? "—"}</strong><span>檔案及資料夾 · 已去重</span></div><div><strong>{overview?.sources.filter(s => s.enabled).length ?? "—"}</strong><span>啟用來源</span></div><div><strong>{overview?.indexed ?? "—"}</strong><span>可搜尋文件內容</span></div><div className={styles.health}><i className={pending ? styles.pending : ""} /><span>{pending ? "正分批建立索引" : overview?.automatic ? "自動檢查已啟用" : "手動同步可用"}<small>新增、改名及搬位會於同步後更新</small></span></div></div>
      <div className={styles.filters}><label className={styles.search}><Search size={16} /><input aria-label="搜尋工作檔案" placeholder="搜尋檔名、資料夾或文件文字…" value={query} onChange={e => { setQuery(e.target.value); reset(); }} /></label><select aria-label="檔案所屬星球" value={planet} onChange={e => { setPlanet(e.target.value); reset(); }}><option value="">所有星球</option>{nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select><select aria-label="檔案來源" value={source} onChange={e => { setSource(e.target.value); reset(); }}><option value="">所有來源</option>{overview?.sources.filter(s => s.enabled).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><select aria-label="檔案類型" value={kind} onChange={e => { setKind(e.target.value); reset(); }}>{resourceKinds.map(k => <option key={k} value={k}>{resourceTypeLabels[k]}</option>)}</select></div>
      {folders.length ? <nav aria-label="檔案資料夾路徑" className={styles.breadcrumb}><button onClick={() => { setFolders([]); setPage(0); }}>全部檔案</button>{folders.map((f, i) => <span key={f.id}><ChevronRight size={12} /><button onClick={() => { setFolders(old => old.slice(0, i + 1)); setPage(0); }}>{f.name}</button></span>)}</nav> : null}
    </> : null}
    {error ? <div role="alert" className={styles.error}><span>{error}</span><SystemButton density="compact" variant="outline" onClick={() => setEpoch(v => v + 1)}>重新讀取</SystemButton></div> : null}
    <div className={styles.resultHeading} aria-live="polite"><span>{loading ? "正在讀取檔案…" : `${result.total} 項${planet && planet !== "core" ? "相關資料" : "資料"}`}</span>{!compact ? <small>管理試算表保留原檔；內容搜尋支援文件、簡報及文字型 PDF</small> : null}</div>
    <div className={styles.fileList} aria-busy={loading}>
      {loading && !files.length ? <div className={styles.empty}><LoaderCircle className={styles.spin} size={24} /><p>正在讀取已收錄資料</p></div> : !files.length ? <div className={styles.empty}><Folder size={27} /><h3>{query || planet || source || kind !== "all" ? "暫時冇符合條件嘅檔案" : "工作資料準備連接"}</h3><p>{pending ? "來源正分批收錄，完成嘅檔案會陸續出現。" : compact ? "可以加入資料來源，再連到呢個星球。" : "加入工作資料夾或文件，保留原本位置，檔案就會集中喺度。"}</p></div> : files.map(file => <article className={styles.file} key={file.id}>
        <div className={styles.fileIcon} data-kind={resourceKind(file.mimeType)}>{file.hasThumbnail && !fixtureMode && !compact ? <img src={`${endpoint}/thumbnail?file=${encodeURIComponent(file.id)}`} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} /> : null}<FileIcon mime={file.mimeType} /></div>
        <div className={styles.fileBody}>{resourceKind(file.mimeType) === "folder" && !compact ? <button className={styles.fileName} onClick={() => { setFolders(old => [...old, { id: file.id, name: file.name }]); setQuery(""); setPage(0); }}>{file.name}<ChevronRight size={13} /></button> : <a className={styles.fileName} href={file.url} target="_blank" rel="noopener noreferrer">{file.name}<ArrowUpRight size={12} /></a>}<p>{file.paths[0]}</p>{!compact && file.snippet && query ? <blockquote>{file.snippet}</blockquote> : null}<div className={styles.fileMeta}><span>{resourceTypeLabels[resourceKind(file.mimeType)]}</span><span>{time(file.modifiedAt)}</span>{file.textState === "pending" ? <span>內容建立中</span> : file.textState === "truncated" ? <span>部分內容可搜尋</span> : file.textState === "unavailable" ? <span>保留原檔入口</span> : null}</div></div>
        {!compact && resourceKind(file.mimeType) !== "folder" ? <SystemButton density="compact" variant="ghost" aria-label={`由檔案建立 Job：${file.name}`} onClick={() => onCreateJob(file)}><Plus size={13} /><span>建立 Job</span></SystemButton> : null}
      </article>)}
    </div>
    {!compact && result.total > result.pageSize ? <div className={styles.pagination}><SystemButton density="compact" variant="outline" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>上一頁</SystemButton><span>{page + 1} / {Math.ceil(result.total / result.pageSize)}</span><SystemButton density="compact" variant="outline" disabled={(page + 1) * result.pageSize >= result.total || loading} onClick={() => setPage(p => p + 1)}>下一頁</SystemButton></div> : null}
    {!compact ? <details className={styles.sources}><summary>來源與同步狀態 <span>{overview?.sources.length ?? 0}</span></summary><p>資料夾會逐層收錄；捷徑保留原連結。停止收錄後，該來源嘅檔案會退出搜尋。</p><div>{overview?.sources.map(s => <article key={s.id}><div><strong>{s.label}</strong><p>{s.fileCount} 項 · {s.enabled ? statusLabels[s.status] : "已停止收錄"} · {time(s.lastSyncedAt)}</p>{s.lastError ? <small role="status">{s.lastError}</small> : null}</div><div className={styles.sourceActions}><SystemButton density="compact" variant="ghost" disabled={busy || !s.enabled} onClick={() => void mutate({ action: "sync", sourceId: s.id })} aria-label={`同步來源：${s.label}`}><RefreshCw size={13} /></SystemButton><SystemButton density="compact" variant="outline" disabled={busy} onClick={() => void mutate({ action: "toggle", sourceId: s.id, enabled: !s.enabled })}>{s.enabled ? "停止收錄" : "重新收錄"}</SystemButton></div></article>)}</div><a href="/reports">檢查 Google 連接<ArrowUpRight size={12} /></a></details> : null}
    <Dialog.Root open={adding} onOpenChange={setAdding}><Dialog.Portal><Dialog.Backdrop className={styles.backdrop} /><Dialog.Popup className={styles.dialog}><div className={styles.dialogHeading}><Dialog.Title>加入工作資料來源</Dialog.Title><Dialog.Close render={<SystemButton density="compact" variant="ghost" aria-label="關閉加入來源" />}><X size={17} /></Dialog.Close></div><Dialog.Description>資料夾會連同子資料夾收錄；原檔位置同分享設定會保留。</Dialog.Description><SourceForm nodes={nodes} busy={busy} onSave={async body => { if (await mutate({ action: "add", ...body })) setAdding(false); }} />{error ? <p role="alert" className={styles.formError}>{error}</p> : null}</Dialog.Popup></Dialog.Portal></Dialog.Root>
  </section>;
}
function SourceForm({ nodes, busy, onSave }: { nodes: Planet[]; busy: boolean; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const [localError, setLocalError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const url = String(data.get("url") || "").trim(); const nodeIds = data.getAll("nodes");
    if (!driveFileId(url) || !nodeIds.length) { setLocalError("請填寫 Google Drive 連結，並選擇至少一個星球。"); return; }
    setLocalError(""); void onSave({ url, label: data.get("label"), nodeIds, contentMode: data.get("contentMode") });
  };
  return <form onSubmit={submit} className={styles.form}><label>Google 資料夾／文件連結<input name="url" type="url" required autoFocus placeholder="https://drive.google.com/…" /></label><label>顯示名稱<input name="label" maxLength={160} placeholder="留空會使用原檔名稱" /></label><fieldset><legend>所屬星球</legend><div className={styles.planetOptions}>{nodes.filter(n => n.kind !== "core").map(n => <label key={n.id}><input type="checkbox" name="nodes" value={n.id} />{n.label}</label>)}</div></fieldset><label>搜尋範圍<select name="contentMode" defaultValue="metadata"><option value="metadata">檔名與路徑（適合管理表／客戶資料）</option><option value="documents">加埋文件文字（適合 Brief／簡報／PDF）</option></select></label>{localError ? <p role="alert" className={styles.formError}>{localError}</p> : null}<SystemButton type="submit" disabled={busy}><Link2 size={15} />{busy ? "正在確認來源…" : "加入並收錄"}</SystemButton></form>;
}
