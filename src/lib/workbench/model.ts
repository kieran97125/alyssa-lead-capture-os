export const planetKinds = ["core", "brand", "workstream", "project", "person", "resource"] as const;
export const planetColors = ["rose", "blue", "amber", "mint", "violet", "slate"] as const;
export const jobStatuses = ["todo", "in_progress", "waiting", "done"] as const;
export type PlanetKind = typeof planetKinds[number];
export type PlanetColor = typeof planetColors[number];
export type JobStatus = typeof jobStatuses[number];
export type Planet = {
  id: string; label: string; subtitle: string; description: string;
  kind: PlanetKind; color: PlanetColor; x: number; y: number;
  space?: { x: number; y: number; z: number };
  url: string; accountId: string; archived: boolean;
};
export type Connection = { id: string; source: string; target: string; label: string; archived: boolean };
export type Job = {
  id: string; nodeId: string; relatedNodeIds: string[]; title: string; description: string;
  status: JobStatus; priority: "high" | "normal" | "low";
  focusDate: string; dueDate: string; assignee: string; briefUrl: string;
  notes: string; checklist: { id: string; label: string; done: boolean }[];
  source: string; archived: boolean;
};
export type WorkbenchDocument = {
  schemaVersion: 1; nodes: Planet[]; edges: Connection[]; jobs: Job[];
  activity: { id: string; label: string; at: string }[];
};
export type WorkbenchRecord = { document: WorkbenchDocument; revision: number; updatedAt: string };
export type WorkbenchContext = {
  checkedAt: string; startDate: string; endDate: string;
  performance: { available: boolean; source: string; updatedAt: string | null; warning: string;
    accounts: { id: string; label: string; leads: number; bookings: number; shows: number }[] };
  creative: { available: boolean; jobs: { id: string; title: string; status: string; dueDate: string; url: string }[] };
  tasks: { available: boolean; jobs: { id: string; title: string; status: string; dueDate: string; url: string }[] };
};
export const kindLabels: Record<PlanetKind, string> = { core: "工作中樞", brand: "品牌", workstream: "工作範疇", project: "專案", person: "協作", resource: "資料來源" };
export const statusLabels: Record<JobStatus, string> = { todo: "待製作／待辦", in_progress: "進行中", waiting: "等候跟進", done: "已完成" };
export const priorityLabels = { high: "優先", normal: "一般", low: "稍後" };
export function hongKongDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function isTodayJob(job: Job, today: string) {
  return !job.archived && job.status !== "done" && (job.focusDate === today || (!!job.dueDate && job.dueDate <= today));
}
export function safeWorkbenchUrl(value: string) {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; }
}

// Canvas documents are versioned, bounded records. They never accept user IDs,
// role flags, executable expressions or arbitrary data-fetch instructions.
export function validateWorkbenchDocument(value: unknown): value is WorkbenchDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const d = value as WorkbenchDocument;
  if (d.schemaVersion !== 1 || !Array.isArray(d.nodes) || !Array.isArray(d.edges) || !Array.isArray(d.jobs) || !Array.isArray(d.activity)) return false;
  if (d.nodes.length > 160 || d.edges.length > 600 || d.jobs.length > 1500 || d.activity.length > 100) return false;
  const text = (s: unknown, max: number) => typeof s === "string" && s.length <= max;
  const id = (s: unknown) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(s);
  const date = (s: unknown) => s === "" || (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
  const nodes = new Set<string>(); const edgeIds = new Set<string>(); const jobIds = new Set<string>();
  for (const n of d.nodes) {
    if (!n || !id(n.id) || nodes.has(n.id) || !text(n.label, 80) || !n.label.trim() || !text(n.subtitle, 160) || !text(n.description, 8000) || !planetKinds.includes(n.kind) || !planetColors.includes(n.color) || !Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x) > 50000 || Math.abs(n.y) > 50000 || !text(n.url, 2000) || !safeWorkbenchUrl(n.url) || !text(n.accountId, 100) || typeof n.archived !== "boolean") return false;
    nodes.add(n.id);
    if (n.space !== undefined && (!n.space || typeof n.space !== "object" || ![n.space.x, n.space.y, n.space.z].every(v => Number.isFinite(v) && Math.abs(v) <= 500))) return false;
  }
  for (const e of d.edges) {
    if (!e || !id(e.id) || edgeIds.has(e.id) || !nodes.has(e.source) || !nodes.has(e.target) || e.source === e.target || !text(e.label, 100) || typeof e.archived !== "boolean") return false;
    edgeIds.add(e.id);
  }
  for (const j of d.jobs) {
    if (!j || !id(j.id) || jobIds.has(j.id) || !nodes.has(j.nodeId) || !text(j.title, 180) || !j.title.trim() || !text(j.description, 12000) || !jobStatuses.includes(j.status) || !["high", "normal", "low"].includes(j.priority) || !date(j.focusDate) || !date(j.dueDate) || !text(j.assignee, 160) || !text(j.briefUrl, 2000) || !safeWorkbenchUrl(j.briefUrl) || !text(j.notes, 12000) || !text(j.source, 600) || typeof j.archived !== "boolean" || !Array.isArray(j.checklist) || j.checklist.length > 50) return false;
    const checks = new Set<string>();
    if (!Array.isArray(j.relatedNodeIds) || j.relatedNodeIds.length > 20 || j.relatedNodeIds.some(n => !nodes.has(n)) || new Set(j.relatedNodeIds).size !== j.relatedNodeIds.length) return false;
    for (const c of j.checklist) { if (!c || !id(c.id) || checks.has(c.id) || !text(c.label, 600) || typeof c.done !== "boolean") return false; checks.add(c.id); }
    jobIds.add(j.id);
  }
  for (const a of d.activity) { if (!a || !id(a.id) || !text(a.label, 600) || !text(a.at, 40) || Number.isNaN(Date.parse(a.at))) return false; }
  return d.nodes.filter(n => n.kind === "core").length === 1 && d.nodes.some(n => n.kind === "core" && n.id === "core" && !n.archived);
}

export function createWorkbenchTemplate(): WorkbenchDocument {
  const planet = (id: string, label: string, kind: PlanetKind, color: PlanetColor, x: number, y: number, subtitle = "", description = "", url = "", accountId = ""): Planet => ({ id, label, kind, color, x, y, subtitle, description, url, accountId, archived: false });
  const nodes: Planet[] = [
    planet("core", "我的 Alyssa", "core", "rose", 0, 0, "工作中樞", "品牌、營銷、團隊同系統之間嘅關係，由呢度開始。"),
    planet("ib", "Ineffable Beauty", "brand", "blue", -430, -260, "IB · 直管品牌", "品牌策略、獲客、Creative、CS 協同及成效。", "/dashboard?accountId=ineffable", "ineffable"),
    planet("gos", "GOS Beauty", "brand", "amber", -510, -25, "GOS · 直管品牌", "荔枝角品牌營運、廣告、Google、Creative、預約及到店。", "/dashboard?accountId=gos-beauty", "gos-beauty"),
    planet("sk", "SkinLight", "brand", "mint", -420, 230, "SK · 直管品牌", "沙田品牌營運、內容、廣告及舊客跟進。", "/dashboard?accountId=skin-light", "skin-light"),
    planet("alyssa", "Alyssa", "brand", "rose", -150, -390, "跨品牌支援", "Aesthetics／Medical／Main：CRM、CS 流程、資料口徑與報表支援。", "/dashboard"),
    planet("strategy", "策略與預算", "workstream", "slate", 110, -355, "方向 · Offer · Budget", "品牌定位、月度目標、療程方向、預算分配與商業增長。", "/kpis"),
    planet("ads", "廣告獲客", "workstream", "amber", 350, -250, "Meta · Google Ads", "投放、受眾、素材成效、CPL／CPBook／CPShow。", "/performance"),
    planet("creative", "Creative 製作", "workstream", "violet", 420, 0, "Brief → 成品 → 上線", "腳本、拍攝、Designer 派工、修改、交片及出街排程。", "/creative-jobs"),
    planet("cs", "CS 與到店", "workstream", "mint", 290, 270, "Lead → Book → Show", "回覆、預約、確認、No Show、Reactive、WhatsApp 推播與獎勵。", "/leads"),
    planet("reports", "數據與報表", "workstream", "blue", 20, 390, "口徑 · 分析 · 收入", "Account／品牌歸屬、Book 去重、Show 日期、成本、收入及 ROAS。", "/reports"),
    planet("systems", "CRM 與自動化", "workstream", "violet", -200, 430, "Lead Sheet · 系統維護", "表單、療程配對、同步、權限、稽核與自動報表。", "/data-sources"),
    planet("team", "團隊與交接", "workstream", "rose", -440, 475, "分工 · 招聘 · SOP", "招聘、交接、工作分配、協作節奏及流程管理。", "/tasks"),
    planet("web", "網站與本地搜尋", "workstream", "slate", -650, 220, "Wix · GBP · Landing Page", "網站、表單、Google 商家檔案與轉化路徑。", "/forms"),
    planet("lead-sheet", "Lead Sheet", "resource", "mint", 560, 470, "原有資料入口", "人工更新與 Book／Show 口徑來源。"),
    planet("slides", "工作進度簡報", "resource", "blue", 300, 560, "每周一 · 草稿", "上周進度、本周計劃、待決定事項。"),
    planet("designer", "Designer 協作", "person", "violet", 700, -110, "派工 · Due · 修改", "由 Creative Jobs 記錄指派日期、Due、負責人、Brief、狀態與品牌。", "/creative-jobs"),
    planet("cs-team", "CS 團隊", "person", "mint", 680, 240, "預約與跟進", "兩組品牌分工及輪更；單人更覆蓋五品牌。"),
  ];
  const edges: Connection[] = [];
  const connect = (source: string, target: string, label: string) => edges.push({ id: `${source}-${target}`, source, target, label, archived: false });
  for (const id of ["ib", "gos", "sk"]) connect("core", id, "直接管理");
  for (const id of ["strategy", "ads", "creative", "cs", "reports", "systems", "team", "web"]) connect("core", id, "工作範疇");
  connect("alyssa", "systems", "跨品牌系統"); connect("alyssa", "reports", "Account 報表");
  connect("ads", "creative", "素材與成效"); connect("ads", "cs", "Lead 跟進");
  connect("cs", "reports", "Book／Show／收入"); connect("systems", "lead-sheet", "資料同步");
  connect("reports", "slides", "觀察與計劃"); connect("creative", "designer", "派工與交片"); connect("cs", "cs-team", "預約與到店");
  return { schemaVersion: 1, nodes, edges, jobs: [], activity: [] };
}
