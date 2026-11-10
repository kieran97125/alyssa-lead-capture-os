"use client";

import dynamic from "next/dynamic";
import { cloneElement, isValidElement, useId, useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type ReactElement } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Orbit, Plus, ListTodo, Network, ArrowUpRight, Search, Undo2, Download, RefreshCw, LockKeyhole, X,
  Check, Link2, Circle, CheckCircle2, Clock3, Pencil, Archive, Pin, GitBranch, LoaderCircle, CalendarDays, AlertCircle, FileJson, ChevronRight } from "lucide-react";
import { SystemButton } from "@/components/system/SystemButton";
import { SystemConfirmationDialog } from "@/components/system/SystemConfirmationDialog";
import { LEAD_ACCOUNTS } from "@/lib/marketing/leadAccountScope";
import { creativeJobStatusLabels } from "@/lib/creative/types";
import { hongKongDate, isTodayJob, kindLabels, planetKinds, planetColors, statusLabels, priorityLabels,
  validateWorkbenchDocument, safeWorkbenchUrl, type Planet, type Job, type WorkbenchContext, type WorkbenchDocument, type WorkbenchRecord, type Connection } from "@/lib/workbench/model";
import { useWorkbench } from "./useWorkbench";
import styles from "./Workbench.module.css";

const GalaxyCanvas = dynamic(() => import("./GalaxyCanvas"), { ssr: false, loading: () => <div className={styles.canvasLoading}><Orbit size={30} /><span>正在展開工作星圖…</span></div> });
const uid = () => crypto.randomUUID();
type Editor = { type: "planet"; value: Planet } | { type: "job"; value: Job } | { type: "edge"; value: Connection } | null;
function download(name: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function prettyTime(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("zh-HK", { timeZone: "Asia/Hong_Kong", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); }
function fields(form: HTMLFormElement) { const data = new FormData(form); return { data, get: (name: string) => String(data.get(name) ?? "").trim() }; }

export function Workbench({ initialRecord, fixtureMode = false, fixtureToday, ownerScope }: { initialRecord?: WorkbenchRecord; fixtureMode?: boolean; fixtureToday?: string; ownerScope?: string }) {
  const wb = useWorkbench(initialRecord, fixtureMode, ownerScope); const d = wb.document;
  const [view, setView] = useState<"galaxy" | "jobs" | "sources">("galaxy");
  const [selectedId, setSelectedId] = useState("core"); const [relatedOnly, setRelatedOnly] = useState(false);
  const [editor, setEditor] = useState<Editor>(null); const [search, setSearch] = useState("");
  const [todayOnly, setTodayOnly] = useState(false); const [status, setStatus] = useState("open");
  const [context, setContext] = useState<WorkbenchContext | null>(null); const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState(""); const [notice, setNotice] = useState(""); const [showArchived, setShowArchived] = useState(false);
  const importFile = useRef<HTMLInputElement>(null); const root = useRef<HTMLDivElement>(null);
  const today = fixtureMode && fixtureToday ? fixtureToday : hongKongDate();
  const refreshContext = useCallback(async () => {
    if (fixtureMode) return;
    setContextLoading(true); setContextError("");
    try { const response = await fetch("/api/internal/workbench/context", { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message); setContext(data); }
    catch { setContextError("系統資料暫時未能讀取；星圖同私人 Jobs 仍然可以使用。"); }
    finally { setContextLoading(false); }
  }, [fixtureMode]);
  useEffect(() => { void refreshContext(); }, [refreshContext]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(""), 4500); return () => clearTimeout(t); }, [notice]);

  const activeNodes = useMemo(() => d?.nodes.filter(n => !n.archived) ?? [], [d?.nodes]);
  const nodeMap = useMemo(() => new Map(d?.nodes.map(n => [n.id, n]) ?? []), [d?.nodes]);
  const selected = nodeMap.get(selectedId) ?? nodeMap.get("core");
  const openJobs = d?.jobs.filter(j => !j.archived && j.status !== "done") ?? [];
  const todayJobs = openJobs.filter(j => isTodayJob(j, today));
  const waitingJobs = openJobs.filter(j => j.status === "waiting");
  const completed = d?.jobs.filter(j => !j.archived && j.status === "done").length ?? 0;
  const belongs = (j: Job) => selectedId === "core" || j.nodeId === selectedId || j.relatedNodeIds.includes(selectedId);
  const jobs = (d?.jobs ?? []).filter(j => !j.archived && (view !== "galaxy" || belongs(j)) && (!todayOnly || isTodayJob(j, today)) &&
    (status === "all" || (status === "open" ? j.status !== "done" : j.status === status)) &&
    (!search || `${j.title} ${j.assignee} ${j.description} ${nodeMap.get(j.nodeId)?.label ?? ""}`.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => Number(isTodayJob(b, today)) - Number(isTodayJob(a, today)) || Number(b.priority === "high") - Number(a.priority === "high") || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const neighbors = d?.edges.filter(e => !e.archived && (e.source === selectedId || e.target === selectedId)).map(e => ({ edge: e, node: nodeMap.get(e.source === selectedId ? e.target : e.source) })).filter(x => x.node && !x.node.archived) ?? [];
  const metric = context?.performance.accounts.find(a => a.id === selected?.accountId);
  const changeJob = (job: Job, edit: Partial<Job>, label: string) => wb.mutate(doc => { const i = doc.jobs.findIndex(j => j.id === job.id); if (i >= 0) doc.jobs[i] = { ...doc.jobs[i], ...edit }; }, label);

  const newPlanet = (position?: { x: number; y: number }) => setEditor({ type: "planet", value: { id: uid(), label: "", subtitle: "", description: "", kind: "project", color: "violet", x: position?.x ?? (selected?.x ?? 0) + 180, y: position?.y ?? (selected?.y ?? 0) + 130, url: "", accountId: "", archived: false } });
  const newJob = () => setEditor({ type: "job", value: { id: uid(), nodeId: selectedId, relatedNodeIds: [], title: "", description: "", status: "todo", priority: "normal", focusDate: today, dueDate: "", assignee: "", briefUrl: "", notes: "", checklist: [], source: "手動新增", archived: false } });
  const newEdge = (source = selectedId, target = activeNodes.find(n => n.id !== source)?.id ?? "") => setEditor({ type: "edge", value: { id: uid(), source, target, label: "相關工作", archived: false } });
  const movePlanet = useCallback((id: string, x: number, y: number) => {
    const old = wb.document?.nodes.find(n => n.id === id); if (!old || (old.x === x && old.y === y)) return;
    wb.mutate(doc => { const node = doc.nodes.find(n => n.id === id); if (node) { node.x = x; node.y = y; } }, `調整星球位置：${old.label}`);
  }, [wb.document, wb.mutate]);
  const saveEditor = (next: Planet | Job | Connection, type: "planet" | "job" | "edge") => {
    const saved = wb.mutate(doc => {
      if (type === "planet") { const value = next as Planet; const i = doc.nodes.findIndex(n => n.id === value.id); if (i < 0) { doc.nodes.push(value); if (selectedId !== value.id) doc.edges.push({ id: uid(), source: selectedId, target: value.id, label: "相關工作", archived: false }); } else doc.nodes[i] = value; }
      else if (type === "job") { const value = next as Job; const i = doc.jobs.findIndex(j => j.id === value.id); if (i < 0) doc.jobs.push(value); else doc.jobs[i] = value; }
      else { const value = next as Connection; const i = doc.edges.findIndex(e => e.id === value.id); if (i < 0) doc.edges.push(value); else doc.edges[i] = value; }
    }, type === "planet" ? `儲存星球：${(next as Planet).label}` : type === "job" ? `儲存 Job：${(next as Job).title}` : `更新關係：${(next as Connection).label}`);
    if (saved) { if (type === "planet") setSelectedId(next.id); setEditor(null); }
  };
  const exportDocument = () => { if (d) download(`Alyssa_Work_Galaxy_${today}.json`, JSON.stringify({ format: "alyssa-private-workbench", revision: wb.revision, exportedAt: new Date().toISOString(), document: d }, null, 2)); };
  const importDocument = async (file: File) => {
    try {
      if (file.size > 1200000) throw new Error("匯入檔案過大。");
      const input = JSON.parse(await file.text()); const next = input.document ?? input;
      if (!validateWorkbenchDocument(next)) throw new Error("檔案格式或星球關係無效。");
      wb.mutate(doc => { Object.assign(doc, next); }, "從備份還原工作星圖"); setSelectedId("core"); setNotice("已載入備份；可按復原返回上一個版本。");
    } catch (e) { setNotice(e instanceof Error ? e.message : "匯入失敗。"); }
    if (importFile.current) importFile.current.value = "";
  };
  const saveLabel = { loading: "正在讀取", saved: "已儲存", pending: "準備儲存", saving: "儲存中", error: "未能儲存", conflict: "版本需要核對" }[wb.state];

  return <div ref={root} className={styles.workbench} data-testid="private-workbench">
    <header className={styles.pageHeader}>
      <div><p className={styles.eyebrow}><Orbit size={14} /> MY PRIVATE WORKSPACE <span>ALYSSA GROWTH OS</span></p><h1>我的工作星圖<span>把工作連成一個整體。</span></h1><p className={styles.intro}>品牌、團隊、Creative、CS 同系統，都喺你嘅工作軌道。</p></div>
      <div className={styles.headerActions}><span className={styles.privatePill}><LockKeyhole size={12} /> Master 私人工作枱</span>
        <SystemButton density="compact" variant="outline" onClick={() => { download("Alyssa_Work_Galaxy.url", `[InternetShortcut]\r\nURL=${window.location.origin}/workbench\r\n`, "application/internet-shortcut"); setNotice("捷徑已下載。將檔案放到桌面，雙擊就可以打開。" ); }}><Download size={14} />桌面捷徑</SystemButton>
      </div>
    </header>
    <section className={styles.summary} aria-label="工作總覽">
      <button onClick={() => { setView("jobs"); setTodayOnly(true); setStatus("open"); }}><span className={styles.summaryIcon}><CalendarDays size={18} /></span><div><span>今日重點</span><strong>{todayJobs.length}<small>件</small></strong></div><ChevronRight size={14} /></button>
      <button onClick={() => { setView("jobs"); setTodayOnly(false); setStatus("open"); }}><span className={styles.summaryIcon}><ListTodo size={18} /></span><div><span>進行中／待辦</span><strong>{openJobs.length}<small>件</small></strong></div><ChevronRight size={14} /></button>
      <button onClick={() => { setView("jobs"); setTodayOnly(false); setStatus("waiting"); }}><span className={styles.summaryIcon}><Clock3 size={18} /></span><div><span>等候跟進</span><strong>{waitingJobs.length}<small>件</small></strong></div><ChevronRight size={14} /></button>
      <button onClick={() => { setView("jobs"); setTodayOnly(false); setStatus("done"); }}><span className={styles.summaryIcon}><CheckCircle2 size={18} /></span><div><span>已完成</span><strong>{completed}<small>件</small></strong></div><ChevronRight size={14} /></button>
    </section>
    <div className={styles.toolbar}>
      <nav aria-label="工作枱檢視" className={styles.viewNav}>
        <SystemButton density="compact" variant={view === "galaxy" ? "default" : "ghost"} aria-pressed={view === "galaxy"} onClick={() => setView("galaxy")}><Network size={14} />星球網絡</SystemButton>
        <SystemButton density="compact" variant={view === "jobs" ? "default" : "ghost"} aria-pressed={view === "jobs"} onClick={() => setView("jobs")}><ListTodo size={14} />Job list</SystemButton>
        <SystemButton density="compact" variant={view === "sources" ? "default" : "ghost"} aria-pressed={view === "sources"} onClick={() => setView("sources")}><Link2 size={14} />系統與資源</SystemButton>
      </nav>
      <div className={styles.tools}><span role="status" className={`${styles.saveState} ${wb.state === "error" || wb.state === "conflict" ? styles.saveError : ""}`} title={updatedAtLabel(wb.updatedAt)}>{wb.state === "saving" ? <LoaderCircle className={styles.spin} size={12} /> : <span className={styles.savedDot} />}{saveLabel}</span>
        <SystemButton density="compact" variant="ghost" onClick={wb.undo} disabled={!wb.undoCount} aria-label="復原上一步" title="復原上一步"><Undo2 size={15} /></SystemButton>
        <SystemButton density="compact" variant="ghost" onClick={exportDocument} disabled={!d} aria-label="匯出工作星圖" title="匯出完整備份"><FileJson size={15} /></SystemButton>
        <SystemButton density="compact" variant="outline" onClick={() => newPlanet()} disabled={!d}><Plus size={14} />新增星球</SystemButton>
        <SystemButton density="compact" onClick={newJob} disabled={!d}><Plus size={14} />新增 Job</SystemButton>
      </div>
    </div>
    {wb.error ? <div role="alert" className={styles.error}><AlertCircle size={17} /><span>{wb.error}</span>{d ? <SystemButton density="compact" variant="outline" onClick={exportDocument}>匯出目前內容</SystemButton> : null}<SystemButton density="compact" variant="outline" onClick={() => { void (wb.state === "conflict" || !d ? wb.load() : wb.flush()); }}>{wb.state === "conflict" || !d ? "重新載入" : "重試儲存"}</SystemButton></div> : null}
    {fixtureMode ? <div className={styles.fixtureNote}>驗收環境 · 示例工作，唔會寫入正式系統。</div> : null}
    {!d ? <div className={styles.canvasLoading}><Orbit size={36} /><span>正在讀取你嘅工作枱…</span></div> : <>
      {view === "galaxy" ? <div className={styles.workspace}>
        <div className={styles.galaxyColumn}>
          <GalaxyCanvas document={d} selectedId={selectedId} relatedOnly={relatedOnly} onSelect={setSelectedId} onMove={movePlanet}
            onAdd={newPlanet} onConnect={c => { if (c.source && c.target && c.source !== c.target) newEdge(c.source, c.target); }} onEdge={id => { const edge = d.edges.find(e => e.id === id); if (edge) setEditor({ type: "edge", value: edge }); }} />
          <div className={styles.graphFooter}><span><i className={`${styles.legendDot} ${styles.blue}`} />品牌 <i className={`${styles.legendDot} ${styles.violet}`} />工作範疇 <i className={`${styles.legendDot} ${styles.mint}`} />協作／資料</span><label><input type="checkbox" checked={relatedOnly} onChange={e => setRelatedOnly(e.target.checked)} />只睇相關星球</label></div>
          <JobList jobs={jobs} nodeMap={nodeMap} today={today} onEdit={j => setEditor({ type: "job", value: j })} onChange={changeJob} search={search} setSearch={setSearch} status={status} setStatus={setStatus} todayOnly={todayOnly} setTodayOnly={setTodayOnly} title={selectedId === "core" ? "工作軌道" : `${selected?.label} · Jobs`} onAdd={newJob} />
        </div>
        <aside className={styles.detailPanel} aria-label="星球詳情">
          {selected ? <>
            <div className={styles.detailHeading}><span className={`${styles.typeBadge} ${styles[selected.color]}`}>{kindLabels[selected.kind]}</span><SystemButton density="compact" variant="ghost" onClick={() => setEditor({ type: "planet", value: selected })} aria-label={`編輯星球：${selected.label}`}><Pencil size={14} /></SystemButton></div>
            <div className={`${styles.detailOrb} ${styles[selected.color]}`} aria-hidden="true"><Orbit size={30} /></div>
            <h2>{selected.label}</h2><p className={styles.detailSubtitle}>{selected.subtitle || "自訂工作節點"}</p><p className={styles.description}>{selected.description || "加入工作說明、相關文件或資料來源。"}</p>
            {selected.url ? <a className={styles.resourceLink} href={selected.url} target="_blank" rel="noopener noreferrer"><Link2 size={14} />打開相關系統／文件<ArrowUpRight size={14} /></a> : null}
            {selected.accountId ? <div className={styles.metrics}><p><span className={styles.liveDot} />本月至今 · Lead／Book／Show</p><div>{[metric?.leads, metric?.bookings, metric?.shows].map((n, i) => <span key={i}><strong>{n ?? "—"}</strong><small>{["Lead", "Book", "Show"][i]}</small></span>)}</div><small>{metric ? `資料時間：${prettyTime(context?.performance.updatedAt ?? "") || "未提供"}` : contextLoading ? "正在讀取原有 Dashboard 資料…" : "資料暫時未能讀取，請按更新核對。"}</small></div> : null}
            <div className={styles.detailSection}><div className={styles.sectionTitle}><h3>工作關係</h3><SystemButton density="compact" variant="ghost" onClick={() => newEdge()} aria-label="新增工作關係"><Plus size={15} /></SystemButton></div>
              {neighbors.length ? neighbors.map(({ edge, node }) => <div key={edge.id} className={styles.relationship}><button onClick={() => setSelectedId(node!.id)}><span className={`${styles.legendDot} ${styles[node!.color]}`} /><span>{node!.label}<small>{edge.label}</small></span></button><SystemButton density="compact" variant="ghost" onClick={() => setEditor({ type: "edge", value: edge })} aria-label={`編輯關係：${node!.label}`}><Pencil size={12} /></SystemButton></div>) : <p className={styles.emptySmall}>拉線或者按 ＋，連接相關工作。</p>}
            </div>
            {selected.id === "creative" || selected.id === "designer" ? <SystemJobs title="現有 Creative Jobs" available={context?.creative.available ?? false} jobs={context?.creative.jobs ?? []} /> : null}
            {selected.id === "team" ? <SystemJobs title="現有系統工作" available={context?.tasks.available ?? false} jobs={context?.tasks.jobs ?? []} /> : null}
            {selected.kind !== "core" ? <div className={styles.archiveControl}><SystemConfirmationDialog triggerLabel="移除星球" triggerIcon={<Archive size={13} />} triggerVariant="ghost" triggerSize="sm" title={`移除「${selected.label}」？`} description="星球會移去封存，Jobs 及關係仍會保留。你可以復原，或者喺「系統與資源」恢復。" confirmControl={<SystemButton onClick={() => { wb.mutate(doc => { const n = doc.nodes.find(n => n.id === selected.id); if (n) n.archived = true; }, `封存星球：${selected.label}`); setSelectedId("core"); }}>移至封存</SystemButton>} /></div> : null}
          </> : null}
        </aside>
      </div> : null}
      {view === "jobs" ? <JobList jobs={jobs} nodeMap={nodeMap} today={today} onEdit={j => setEditor({ type: "job", value: j })} onChange={changeJob} search={search} setSearch={setSearch} status={status} setStatus={setStatus} todayOnly={todayOnly} setTodayOnly={setTodayOnly} title="所有工作 · Job list" onAdd={newJob} /> : null}
      {view === "sources" ? <section className={styles.sources}>
        <div className={styles.sectionTitle}><div><h2>連起現有系統，同你嘅工作。</h2><p>私人 Jobs 獨立保存；下列資料直接讀取原有系統，按連結可處理正式工作。</p></div><SystemButton density="compact" variant="outline" onClick={() => { void refreshContext(); }} disabled={contextLoading}><RefreshCw size={14} className={contextLoading ? styles.spin : ""} />更新系統資料</SystemButton></div>
        <div className={styles.sourceCards}><SourceCard title="Lead／Book／Show" description={context?.performance.available ? `本月 1 號至 ${context.endDate} · ${context.performance.source}` : "讀取原有 Dashboard 嘅已儲存資料"} available={context?.performance.available ?? false} url="/dashboard" />
          <SourceCard title="Creative Jobs" description="已連接設計工作，於星球詳情查看最近記錄。" available={context?.creative.available ?? false} url="/creative-jobs" />
          <SourceCard title="工作事項與營銷日曆" description="保留原有工作分配、排程及團隊通知。" available={context?.tasks.available ?? false} url="/tasks" /></div>
        {contextError ? <p role="alert" className={styles.warning}>{contextError}</p> : null}
        {context?.performance.warning ? <p className={styles.warning}>{context.performance.warning}</p> : null}
        <div className={styles.sectionTitle}><h3>星球文件入口</h3><SystemButton density="compact" variant="outline" onClick={() => newPlanet()}><Plus size={14} />新增資料星球</SystemButton></div>
        <div className={styles.linkGrid}>{activeNodes.filter(n => n.url).map(n => <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"><span className={`${styles.legendDot} ${styles[n.color]}`} /><span><strong>{n.label}</strong><small>{n.subtitle || kindLabels[n.kind]}</small></span><ArrowUpRight size={15} /></a>)}</div>
        <div className={styles.backupRow}><div><h3>工作枱備份</h3><p>網絡、Jobs、Checklist 同備註會一齊匯出。還原後可以復原上一步。</p></div><SystemButton density="compact" variant="outline" onClick={exportDocument}><Download size={14} />匯出 JSON</SystemButton><SystemButton density="compact" variant="outline" onClick={() => importFile.current?.click()}>匯入備份</SystemButton><input ref={importFile} type="file" accept="application/json,.json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void importDocument(file); }} /></div>
        <div className={styles.sectionTitle}><h3>封存項目</h3><SystemButton density="compact" variant="ghost" aria-expanded={showArchived} onClick={() => setShowArchived(!showArchived)}>{showArchived ? "收起" : "查看封存"}</SystemButton></div>
        {showArchived ? <div className={styles.archivedList}>{d.nodes.filter(n => n.archived).map(n => <div key={n.id}><span>星球 · {n.label}</span><SystemButton density="compact" variant="outline" onClick={() => wb.mutate(doc => { doc.nodes.find(x => x.id === n.id)!.archived = false; }, `恢復星球：${n.label}`)}>恢復</SystemButton></div>)}{d.jobs.filter(j => j.archived).map(j => <div key={j.id}><span>Job · {j.title}</span><SystemButton density="compact" variant="outline" onClick={() => changeJob(j, { archived: false }, `恢復 Job：${j.title}`)}>恢復</SystemButton></div>)}{d.edges.filter(e => e.archived).map(e => <div key={e.id}><span>關係 · {nodeMap.get(e.source)?.label} → {nodeMap.get(e.target)?.label} · {e.label}</span><SystemButton density="compact" variant="outline" onClick={() => wb.mutate(doc => { doc.edges.find(x => x.id === e.id)!.archived = false; }, "恢復工作關係")}>恢復</SystemButton></div>)}{![...d.nodes, ...d.jobs, ...d.edges].some(x => x.archived) ? <p className={styles.emptySmall}>暫時冇封存項目。</p> : null}</div> : null}
        <details className={styles.activity}><summary>最近更新紀錄</summary>{d.activity.slice(0, 15).map(a => <p key={a.id}><span>{a.label}</span><small>{prettyTime(a.at)}</small></p>)}</details>
      </section> : null}
    </>}
    <footer className={styles.pageFooter}><span><LockKeyhole size={11} />私人工作資料 · 香港時間</span><span>{today} · {activeNodes.length} 個星球 · {d?.edges.filter(e => !e.archived).length ?? 0} 條關係</span></footer>
    {notice ? <div role="status" className={styles.toast}>{notice}</div> : null}
    {editor && d ? <WorkbenchEditor key={`${editor.type}-${editor.value.id}`} editor={editor} nodes={d.nodes} today={today} onClose={() => setEditor(null)} onSave={saveEditor} onArchive={() => {
      if (editor.type === "job") { changeJob(editor.value, { archived: true }, `封存 Job：${editor.value.title}`); }
      else if (editor.type === "edge") wb.mutate(doc => { const edge = doc.edges.find(e => e.id === editor.value.id); if (edge) edge.archived = true; }, "移除工作關係");
      setEditor(null);
    }} /> : null}
  </div>;
}

function updatedAtLabel(value: string) { return value ? `上次儲存：${prettyTime(value)}` : ""; }
function JobList({ jobs, nodeMap, today, onEdit, onChange, search, setSearch, status, setStatus, todayOnly, setTodayOnly, title, onAdd }: {
  jobs: Job[]; nodeMap: Map<string, Planet>; today: string; onEdit: (j: Job) => void;
  onChange: (j: Job, change: Partial<Job>, label: string) => void; search: string; setSearch: (s: string) => void;
  status: string; setStatus: (s: string) => void; todayOnly: boolean; setTodayOnly: (v: boolean) => void; title: string; onAdd: () => void;
}) {
  return <section className={styles.jobs} aria-label={title} data-testid="workbench-jobs"><header className={styles.jobsHeader}><h2>{title}<span>{jobs.length}</span></h2><SystemButton density="compact" variant={todayOnly ? "secondary" : "ghost"} aria-pressed={todayOnly} onClick={() => setTodayOnly(!todayOnly)}><Pin size={13} />今日</SystemButton><label className={styles.search}><Search size={14} /><input aria-label="搜尋 Jobs" placeholder="搜尋工作…" value={search} onChange={e => setSearch(e.target.value)} /></label><select className={styles.select} aria-label="工作狀態篩選" value={status} onChange={e => setStatus(e.target.value)}><option value="open">未完成</option><option value="all">全部狀態</option>{Object.entries(statusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></header>
      <div className={styles.jobRows}>{jobs.map(j => <article key={j.id} className={`${styles.jobRow} ${j.status === "done" ? styles.done : ""}`} data-testid={`job-${j.id}`}>
        <input className={styles.jobCheck} type="checkbox" aria-label={`標記完成：${j.title}`} checked={j.status === "done"} onChange={e => onChange(j, { status: e.target.checked ? "done" : "todo" }, `${e.target.checked ? "完成" : "重新開始"}：${j.title}`)} />
        <button className={styles.jobTitle} onClick={() => onEdit(j)}><strong>{j.title}</strong><span>{nodeMap.get(j.nodeId)?.label ?? "已封存星球"}{j.relatedNodeIds.length ? ` · ${j.relatedNodeIds.map(id => nodeMap.get(id)?.label).filter(Boolean).join("／")}` : ""}</span>{j.source && j.source !== "手動新增" ? <small>{j.source}</small> : null}</button>
        <div className={styles.jobMeta}>{j.priority === "high" ? <span className={styles.priority}>優先</span> : null}{isTodayJob(j, today) ? <span className={styles.todayTag}>今日</span> : null}<span className={styles.jobStatus} data-status={j.status}>{statusLabels[j.status]}</span><span className={j.dueDate && j.dueDate < today && j.status !== "done" ? styles.overdue : ""}>{j.dueDate || "未定 Due"}</span></div>
        <SystemButton density="compact" variant="ghost" aria-label={`編輯 Job：${j.title}`} onClick={() => onEdit(j)}><ChevronRight size={15} /></SystemButton>
      </article>)}</div>{!jobs.length ? <div className={styles.empty}><CheckCircle2 size={24} /><strong>呢個軌道暫時冇符合嘅工作。</strong><span>可以調整篩選，或者加一個下一步。</span><SystemButton density="compact" variant="outline" onClick={onAdd}><Plus size={13} />新增 Job</SystemButton></div> : null}
  </section>;
}

function SourceCard({ title, description, available, url }: { title: string; description: string; available: boolean; url: string }) {
  return <a href={url} className={styles.sourceCard}><div><Link2 size={19} /><ArrowUpRight size={16} /></div><h3>{title}</h3><p>{description}</p><span className={available ? styles.available : styles.unavailable}>{available ? "已讀取原有系統" : "暫未讀取"}</span></a>;
}
function SystemJobs({ title, available, jobs }: { title: string; available: boolean; jobs: { id: string; title: string; status: string; dueDate: string; url: string }[] }) {
  const labels: Record<string, string> = { ...creativeJobStatusLabels, ...statusLabels };
  return <div className={styles.detailSection}><h3>{title}</h3><p className={styles.emptySmall}>正式工作狀態以原有系統為準。</p>{!available ? <p className={styles.emptySmall}>資料暫時未能讀取。</p> : !jobs.length ? <p className={styles.emptySmall}>未有工作記錄。</p> : jobs.slice(0, 6).map(j => <a key={j.id} href={j.url} className={styles.systemJob}><span>{j.title}<small>{labels[j.status] ?? "待核對"} · {j.dueDate || "未定 Due"}</small></span><ArrowUpRight size={13} /></a>)}</div>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  const id = useId();
  return <div className={`${styles.field} ${wide ? styles.wide : ""}`}><label htmlFor={id}>{label}</label>{isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}</div>;
}
function WorkbenchEditor({ editor, nodes, today, onClose, onSave, onArchive }: { editor: NonNullable<Editor>; nodes: Planet[]; today: string; onClose: () => void; onSave: (next: Planet | Job | Connection, type: "planet" | "job" | "edge") => void; onArchive: () => void }) {
  const [error, setError] = useState(""); const type = editor.type;
  const [checks, setChecks] = useState<Record<string, boolean>>(() => editor.type === "job" ? Object.fromEntries(editor.value.checklist.map(c => [c.id, c.done])) : {});
  const title = type === "planet" ? editor.value.label ? "編輯星球" : "新增星球" : type === "job" ? editor.value.title ? "編輯 Job" : "新增 Job" : "連接工作星球";
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const { get, data } = fields(event.currentTarget); setError("");
    if (type === "planet") { const p = editor.value; if (!safeWorkbenchUrl(get("url"))) { setError("文件連結請用 https:// 或系統內路徑。"); return; }
      onSave({ ...p, label: get("label"), subtitle: get("subtitle"), description: get("description"), kind: (p.kind === "core" ? "core" : get("kind")) as Planet["kind"], color: get("color") as Planet["color"], url: get("url"), accountId: get("accountId") }, type);
    } else if (type === "job") {
      const j = editor.value; if (!safeWorkbenchUrl(get("briefUrl"))) { setError("Brief 連結格式無效。"); return; }
      const lines = get("checklist").split("\n").map(s => s.trim()).filter(Boolean); if (lines.length > 50) { setError("Checklist 最多 50 項。"); return; }
      if (new Set(lines).size !== lines.length) { setError("Checklist 每個項目只需要寫一次。"); return; }
      onSave({ ...j, title: get("title"), description: get("description"), nodeId: get("nodeId"), relatedNodeIds: data.getAll("relatedNodeIds").map(String).filter(id => id !== get("nodeId")), status: get("status") as Job["status"], priority: get("priority") as Job["priority"], focusDate: data.has("today") ? today : "", dueDate: get("dueDate"), assignee: get("assignee"), briefUrl: get("briefUrl"), notes: get("notes"), checklist: lines.map(label => { const c = j.checklist.find(c => c.label === label); return c ? { ...c, done: checks[c.id] ?? c.done } : { id: uid(), label, done: false }; }) }, type);
    } else { const edge = editor.value; if (get("source") === get("target")) { setError("請選擇兩個唔同星球。"); return; } onSave({ ...edge, source: get("source"), target: get("target"), label: get("label") }, type); }
  };
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Backdrop className={styles.backdrop} /><Dialog.Popup className={styles.dialog}>
    <div className={styles.dialogHeader}><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{type === "planet" ? "定義呢粒星球嘅工作範圍，同佢連接嘅資料。" : type === "job" ? "記清下一步、負責人、Due 同跟進。" : "關係可以係負責、協作、依賴、數據來源，或者你自己定義。"}</Dialog.Description></div><Dialog.Close render={<SystemButton density="compact" variant="ghost" aria-label="關閉編輯視窗" />}><X size={17} /></Dialog.Close></div>
    <form onSubmit={save} className={styles.editorForm}>
      {type === "planet" ? <><Field label="星球名稱" wide><input name="label" required maxLength={80} defaultValue={editor.value.label} autoFocus placeholder="例如：11 月推廣、拍攝、CRM…" /></Field><Field label="類型"><select name="kind" defaultValue={editor.value.kind} disabled={editor.value.kind === "core"}>{planetKinds.filter(k => k !== "core" || editor.value.kind === "core").map(k => <option key={k} value={k}>{kindLabels[k]}</option>)}</select></Field><Field label="星球顏色"><select name="color" defaultValue={editor.value.color}>{planetColors.map((color, i) => <option key={color} value={color}>{["玫瑰", "冰藍", "琥珀", "薄荷", "紫羅蘭", "銀灰"][i]}</option>)}</select></Field><Field label="副標題" wide><input name="subtitle" maxLength={160} defaultValue={editor.value.subtitle} /></Field><Field label="工作範圍／說明" wide><textarea name="description" rows={4} maxLength={8000} defaultValue={editor.value.description} /></Field><Field label="相關文件／系統連結" wide><input name="url" maxLength={2000} defaultValue={editor.value.url} placeholder="https://… 或 /creative-jobs" /></Field><Field label="連接原有 Account 數據" wide><select name="accountId" defaultValue={editor.value.accountId}><option value="">唔連接 Account</option>{LEAD_ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select></Field></> : null}
      {type === "job" ? <><Field label="工作名稱" wide><input name="title" required maxLength={180} defaultValue={editor.value.title} autoFocus /></Field><Field label="主要星球"><select name="nodeId" defaultValue={editor.value.nodeId}>{nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field><Field label="狀態"><select name="status" defaultValue={editor.value.status}>{Object.entries(statusLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></Field><Field label="優先次序"><select name="priority" defaultValue={editor.value.priority}>{Object.entries(priorityLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></Field><Field label="Due date"><input name="dueDate" type="date" defaultValue={editor.value.dueDate} /></Field><Field label="負責人／跟進人"><input name="assignee" maxLength={160} defaultValue={editor.value.assignee} placeholder="未指派" /></Field><label className={styles.todayField}><input name="today" type="checkbox" defaultChecked={editor.value.focusDate === today} />列入今日重點</label><Field label="工作說明／下一步" wide><textarea name="description" rows={3} maxLength={12000} defaultValue={editor.value.description} /></Field><Field label="關聯星球（可多選）" wide><select multiple name="relatedNodeIds" defaultValue={editor.value.relatedNodeIds} size={4}>{nodes.filter(n => n.kind !== "core").map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field><Field label="Brief／檔案連結" wide><input name="briefUrl" maxLength={2000} defaultValue={editor.value.briefUrl} /></Field>
        {editor.value.checklist.length ? <div className={`${styles.checklist} ${styles.wide}`}><h4>執行 Checklist</h4>{editor.value.checklist.map(c => <label key={c.id}><input type="checkbox" checked={checks[c.id] ?? c.done} onChange={e => setChecks(current => ({ ...current, [c.id]: e.target.checked }))} />{c.label}</label>)}</div> : null}
        <Field label="Checklist 項目（每行一項）" wide><textarea name="checklist" rows={4} maxLength={20000} defaultValue={editor.value.checklist.map(c => c.label).join("\n")} /></Field><Field label="備註／跟進記錄" wide><textarea name="notes" rows={3} maxLength={12000} defaultValue={editor.value.notes} /></Field>{editor.value.source ? <p className={`${styles.sourceNote} ${styles.wide}`}>{editor.value.source}</p> : null}</> : null}
      {type === "edge" ? <><Field label="由"><select name="source" defaultValue={editor.value.source}>{nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field><Field label="連到"><select name="target" defaultValue={editor.value.target}>{nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></Field><Field label="關係名稱" wide><input name="label" maxLength={100} defaultValue={editor.value.label} placeholder="例如：需要素材、資料來源、協作" /></Field></> : null}
      {error ? <p role="alert" className={`${styles.warning} ${styles.wide}`}>{error}</p> : null}
      <div className={styles.formFooter}>{type === "job" && editor.value.title || type === "edge" ? <SystemButton type="button" density="compact" variant="ghost" onClick={onArchive}><Archive size={14} />移至封存</SystemButton> : <span />}<div><SystemButton type="button" variant="outline" onClick={onClose}>取消</SystemButton><SystemButton type="submit"><Check size={15} />儲存{type === "planet" ? "星球" : type === "job" ? " Job" : "關係"}</SystemButton></div></div>
    </form>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
