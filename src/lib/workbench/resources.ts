export const resourceKinds = ["all", "folder", "image", "video", "document", "sheet", "slides", "pdf"] as const;
export type ResourceKind = typeof resourceKinds[number];
export type SourceStatus = "queued" | "syncing" | "ready" | "partial" | "error" | "auth_required";
export type ResourceSource = {
  id: string; label: string; driveFileId: string; kind: "folder" | "file";
  nodeIds: string[]; enabled: boolean; contentMode: "metadata" | "documents";
  status: SourceStatus; fileCount: number; lastSyncedAt: string | null;
  lastError: string; updatedAt: string;
};
export type WorkResource = {
  id: string; name: string; mimeType: string; url: string; modifiedAt: string | null;
  size: number | null; hasThumbnail: boolean; textState: string;
  paths: string[]; nodeIds: string[]; sourceIds: string[]; snippet: string;
};
export type ResourceResult = { files: WorkResource[]; total: number; page: number; pageSize: number };
export type ResourceOverview = { sources: ResourceSource[]; total: number; indexed: number; pending: number; checkedAt: string; automatic: boolean };
export const resourceTypeLabels: Record<ResourceKind, string> = { all: "全部類型", folder: "資料夾", image: "圖片", video: "影片", document: "文件", sheet: "試算表", slides: "簡報", pdf: "PDF" };
export function driveFileId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname)) return null;
    const match = url.pathname.match(/\/(?:folders|d)\/([A-Za-z0-9_-]{10,200})(?:\/|$)/);
    const id = match?.[1] ?? url.searchParams.get("id");
    return id && /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : null;
  } catch { return null; }
}
export function resourceKind(mime: string): ResourceKind {
  if (mime === "application/vnd.google-apps.folder") return "folder";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (/spreadsheet|excel|csv/.test(mime)) return "sheet";
  if (/presentation|powerpoint/.test(mime)) return "slides";
  if (mime === "application/pdf") return "pdf";
  return "document";
}
export function contentIndexable(mime: string) {
  return ["application/vnd.google-apps.document", "application/vnd.google-apps.presentation", "application/pdf", "text/plain", "text/markdown"].includes(mime);
}
export function safeDriveUrl(id: string, mime: string) {
  const part = mime === "application/vnd.google-apps.document" ? "document" : mime === "application/vnd.google-apps.spreadsheet" ? "spreadsheets" : mime === "application/vnd.google-apps.presentation" ? "presentation" : "";
  return part ? `https://docs.google.com/${part}/d/${encodeURIComponent(id)}/edit` : mime === "application/vnd.google-apps.folder" ? `https://drive.google.com/drive/folders/${encodeURIComponent(id)}` : `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
}
export type FolderBinding = { fileId: string; nodeIds: string[]; nameTerms?: string[] };
export function resourceNodes(base: string[], bindings: FolderBinding[], ancestors: string[], path = "") {
  const normalized = path.normalize("NFKC").toLowerCase();
  const matchesTerm = (term: string) => {
    const value = term.normalize("NFKC").toLowerCase(); if (!value || value.length > 80) return false;
    let at = normalized.indexOf(value);
    while (at >= 0) {
      const before = normalized[at - 1] || "", after = normalized[at + value.length] || "";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
      at = normalized.indexOf(value, at + value.length);
    }
    return false;
  };
  return [...new Set([...base, ...bindings.filter(b => ancestors.includes(b.fileId) || b.nameTerms?.some(matchesTerm)).flatMap(b => b.nodeIds)])];
}
