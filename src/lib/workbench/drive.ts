import "server-only";
import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";

export type DriveFile = { id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string; size?: string; description?: string; hasThumbnail?: boolean; thumbnailLink?: string; trashed?: boolean };
const fields = "id,name,mimeType,parents,modifiedTime,size,description,hasThumbnail,trashed";
export class DriveReadError extends Error {
  constructor(public status: number, public retryable = status === 408 || status === 429 || status >= 500) { super(retryable ? "Google 暫時未能讀取，稍後會自動繼續。" : status === 401 ? "Google 連接需要重新授權。" : status === 403 || status === 404 ? "資料已移除或 Google 帳戶未能存取。" : "Google 暫時未能讀取，稍後會自動繼續。"); }
}
export function isRetryableDriveRead(error: unknown) { return error instanceof DriveReadError ? error.retryable || error.status === 401 : error instanceof Error && ["TypeError", "AbortError", "TimeoutError"].includes(error.name); }
export async function driveToken(signal?: AbortSignal) {
  return getGoogleSheetsOAuthAccessToken({ requireReports: true, recordHealth: false, signal });
}
async function read(token: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "error" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const quota = (data?.error?.errors ?? []).some((e: { reason?: string }) => ["rateLimitExceeded", "userRateLimitExceeded", "downloadQuotaExceeded", "backendError", "internalError"].includes(e.reason ?? ""));
    throw new DriveReadError(response.status, quota || response.status === 408 || response.status === 429 || response.status >= 500);
  }
  return response;
}
export async function getDriveFile(token: string, id: string, thumbnail = false): Promise<DriveFile> {
  return (await read(token, `files/${encodeURIComponent(id)}`, { fields: thumbnail ? `${fields},thumbnailLink` : fields, supportsAllDrives: "true" })).json();
}
export async function listDriveFolder(token: string, id: string, pageToken?: string): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  return (await read(token, "files", { q: `'${id}' in parents and trashed = false`, pageSize: "200", fields: `nextPageToken,incompleteSearch,files(${fields})`, supportsAllDrives: "true", includeItemsFromAllDrives: "true", ...(pageToken ? { pageToken } : {}) })).json().then(result => {
    if (result.incompleteSearch) throw new Error("Google 未能完整列出資料夾，稍後會繼續核對。");
    return result;
  });
}
async function boundedBytes(response: Response, limit: number) {
  if (Number(response.headers.get("content-length")) > limit) throw new Error("檔案超過內容索引大小，仍可由原檔開啟。");
  const reader = response.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) throw new Error("檔案超過內容索引大小，仍可由原檔開啟。"); chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return bytes;
}
export async function readDriveText(token: string, file: Pick<DriveFile, "id" | "mimeType" | "size">) {
  const native = file.mimeType.startsWith("application/vnd.google-apps.");
  const response = await read(token, `files/${encodeURIComponent(file.id)}${native ? "/export" : ""}`, native ? { mimeType: "text/plain" } : { alt: "media", supportsAllDrives: "true" });
  const bytes = await boundedBytes(response, file.mimeType === "application/pdf" ? 6000000 : 1000000);
  let text: string;
  if (file.mimeType === "application/pdf") {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes, { maxImageSize: 1000000, useSystemFonts: false });
    try { if (pdf.numPages > 100) throw new Error("PDF 超過 100 頁，已保留原檔入口。"); text = (await extractText(pdf, { mergePages: true })).text; }
    finally { await pdf.loadingTask.destroy(); }
  } else text = new TextDecoder().decode(bytes);
  const normalized = text.replace(/\u0000/g, "").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { text: normalized.slice(0, 60000), state: normalized.length > 60000 ? "truncated" : normalized ? "indexed" : "empty" };
}
export async function readDriveThumbnail(token: string, id: string) {
  const file = await getDriveFile(token, id, true);
  if (!file.thumbnailLink) return null;
  const url = new URL(file.thumbnailLink);
  if (url.protocol !== "https:" || !/(^|\.)googleusercontent\.com$/.test(url.hostname)) return null;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000), redirect: "error" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return null;
  return { bytes: await boundedBytes(response, 1000000), type: response.headers.get("content-type")! };
}
