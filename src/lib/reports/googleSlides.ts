import "server-only";

import { randomUUID } from "node:crypto";
import { getGoogleSheetsOAuthAccessToken } from "@/lib/integrations/googleSheetsOAuth";
import { ReportExportError } from "@/lib/reports/snapshot";
import type { ReportSnapshot } from "@/lib/reports/types";

// Report delivery configuration belongs to this client, never to the renderer.
export const REPORT_GOOGLE_DRIVE_FOLDER_ID = "1CACmGEE3rTEASDx10FZpgDTrfRNpkBRN";
const GOOGLE_SLIDES_MIME_TYPE = "application/vnd.google-apps.presentation";
const GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DRIVE_ORIGIN = "https://www.googleapis.com";
const DELIVERY_TIMEOUT_MS = 40_000;
const MULTIPART_UPLOAD_LIMIT_BYTES = 5_000_000;

type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  parents?: string[];
  webViewLink?: string;
  trashed?: boolean;
  capabilities?: { canAddChildren?: boolean };
};

export type GoogleSlidesReport = {
  id: string;
  name: string;
  url: string;
  mimeType: typeof GOOGLE_SLIDES_MIME_TYPE;
  folderId: string;
  reportId: string;
  snapshotId: string;
};

export function googleSlidesReportName(snapshot: ReportSnapshot) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(snapshot.generatedAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const generatedDate = `${part("year")}-${part("month")}-${part("day")}`;
  return `${generatedDate}_${snapshot.current.startDate}_${snapshot.current.endDate}_CS_AD報數`;
}

function driveMetadataUrl(fileId: string, fields: string) {
  const url = new URL(`/drive/v3/files/${encodeURIComponent(fileId)}`, DRIVE_ORIGIN);
  url.searchParams.set("fields", fields);
  url.searchParams.set("supportsAllDrives", "true");
  return url;
}

function safePresentationUrl(value: unknown, fileId: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "docs.google.com" &&
      url.pathname.startsWith(`/presentation/d/${fileId}/`);
  } catch {
    return false;
  }
}

async function readDriveResponse(response: Response, stage: "folder" | "create" | "verify"): Promise<DriveFile> {
  const payload = await response.json().catch(() => null) as (DriveFile & {
    error?: { status?: string; errors?: Array<{ reason?: string }> };
  }) | null;
  if (!response.ok) {
    const reasons = payload?.error?.errors?.map((error) => error.reason) || [];
    if (response.status === 401 || reasons.includes("insufficientPermissions") || payload?.error?.status === "UNAUTHENTICATED") {
      throw new ReportExportError(
        "公司 Google 帳戶未授權報告儲存。請由管理員使用報告頁的「連接 Google Drive」完成授權。",
        409, "drive_authorization_required"
      );
    }
    if (stage === "folder" && [403, 404].includes(response.status)) {
      throw new ReportExportError(
        "Google 帳戶未能存取指定報告資料夾。請確認所連接的公司 Google 帳戶具備此資料夾的新增檔案權限。",
        409, "drive_folder_access_required"
      );
    }
    throw new ReportExportError(
      stage === "create"
        ? "Google Slides 未能生成，請稍後再試。"
        : stage === "verify"
          ? "Google Slides 已提交，但未能確認儲存結果。請先查看報告資料夾，避免重複生成。"
          : "暫時未能確認 Google Drive 報告資料夾，請稍後再試。",
      502, `drive_${stage}_failed`
    );
  }
  if (!payload) throw new ReportExportError("Google Drive 回覆格式不正確。", 502, "drive_response_invalid");
  return payload;
}

/** Import the approved editable PPTX as native Slides; never retry a creation. */
export async function exportReportToGoogleSlides(
  snapshot: ReportSnapshot,
  options: { signal?: AbortSignal } = {}
): Promise<GoogleSlidesReport> {
  const timeout = AbortSignal.timeout(DELIVERY_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let creationStarted = false;

  try {
    let accessToken: string;
    try {
      accessToken = await getGoogleSheetsOAuthAccessToken({ signal, recordHealth: false, requireReports: true });
    } catch {
      signal.throwIfAborted();
      throw new ReportExportError(
        "公司 Google 帳戶尚未連接報告儲存。請由管理員使用報告頁的「連接 Google Drive」完成授權。",
        409, "drive_authorization_required"
      );
    }
    const headers = { authorization: `Bearer ${accessToken}` };
    const folder = await readDriveResponse(await fetch(
      driveMetadataUrl(REPORT_GOOGLE_DRIVE_FOLDER_ID, "id,mimeType,trashed,capabilities(canAddChildren)"),
      { headers, signal, cache: "no-store", redirect: "error" }
    ), "folder");
    if (folder.id !== REPORT_GOOGLE_DRIVE_FOLDER_ID || folder.mimeType !== GOOGLE_FOLDER_MIME_TYPE ||
        folder.trashed || folder.capabilities?.canAddChildren !== true) {
      throw new ReportExportError("指定 Google Drive 資料夾未獲新增檔案權限。請管理員確認資料夾權限。", 409, "drive_folder_not_writable");
    }

    const { renderReportPptx } = await import("@/lib/reports/pptx");
    const pptx = await renderReportPptx(snapshot);
    signal.throwIfAborted();
    const name = googleSlidesReportName(snapshot);
    const metadata = JSON.stringify({ name, mimeType: GOOGLE_SLIDES_MIME_TYPE, parents: [folder.id] });
    const createUrl = new URL("/upload/drive/v3/files", DRIVE_ORIGIN);
    createUrl.searchParams.set("supportsAllDrives", "true");
    createUrl.searchParams.set("fields", "id");
    // One request only: a timeout can mean Google created the file successfully.
    creationStarted = true;
    let createResponse: Response;
    if (pptx.byteLength > MULTIPART_UPLOAD_LIMIT_BYTES) {
      // The approved template embeds fonts and can exceed the multipart limit.
      createUrl.searchParams.set("uploadType", "resumable");
      const session = await fetch(createUrl, {
        method: "POST", headers: {
          ...headers, "content-type": "application/json; charset=UTF-8",
          "x-upload-content-type": PPTX_MIME_TYPE,
          "x-upload-content-length": String(pptx.byteLength),
        }, body: metadata, signal, redirect: "error",
      });
      if (!session.ok) await readDriveResponse(session, "create");
      let uploadUrl: URL | null = null;
      try {
        const candidate = new URL(session.headers.get("location") || "");
        if (candidate.origin === DRIVE_ORIGIN && candidate.pathname === "/upload/drive/v3/files" &&
            candidate.searchParams.has("upload_id") && !candidate.username && !candidate.password) uploadUrl = candidate;
      } catch { /* A session URL must come directly from the trusted Drive API. */ }
      if (!uploadUrl) {
        throw new ReportExportError("Google 未返回有效上載連線，報告未能確認生成。請先查看報告資料夾。", 502, "drive_upload_session_invalid");
      }
      // Complete that one session once; never initialize or retry another file.
      createResponse = await fetch(uploadUrl, {
        method: "PUT", headers: {
          ...headers, "content-type": PPTX_MIME_TYPE,
          "content-length": String(pptx.byteLength),
        }, body: Buffer.from(pptx), signal, redirect: "error",
      });
    } else {
      createUrl.searchParams.set("uploadType", "multipart");
      const boundary = `report-${randomUUID()}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
        Buffer.from(`--${boundary}\r\nContent-Type: ${PPTX_MIME_TYPE}\r\n\r\n`),
        Buffer.from(pptx),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      createResponse = await fetch(createUrl, {
        method: "POST", headers: { ...headers, "content-type": `multipart/related; boundary=${boundary}` },
        body, signal, redirect: "error",
      });
    }
    const created = await readDriveResponse(createResponse, "create");
    if (!created.id || !/^[a-zA-Z0-9_-]+$/.test(created.id)) {
      throw new ReportExportError("Google Slides 已提交，但未取得檔案編號。請先查看報告資料夾。", 502, "drive_creation_unconfirmed");
    }
    const file = await readDriveResponse(await fetch(
      driveMetadataUrl(created.id, "id,name,mimeType,parents,webViewLink,trashed"),
      { headers, signal, cache: "no-store", redirect: "error" }
    ), "verify");
    if (file.id !== created.id || file.mimeType !== GOOGLE_SLIDES_MIME_TYPE || file.trashed ||
        !file.parents?.includes(folder.id) || !safePresentationUrl(file.webViewLink, created.id) || file.name !== name) {
      throw new ReportExportError("Google Slides 已提交，但檔案格式或儲存位置未確認。請先查看報告資料夾。", 502, "drive_verification_failed");
    }
    return {
      id: file.id, name: file.name, url: file.webViewLink,
      mimeType: GOOGLE_SLIDES_MIME_TYPE, folderId: folder.id,
      reportId: snapshot.reportId, snapshotId: snapshot.snapshotId,
    };
  } catch (error) {
    if (error instanceof ReportExportError) throw error;
    throw new ReportExportError(
      creationStarted
        ? "Google Slides 已提交，但連線未確認結果。請先查看報告資料夾，避免重複生成。"
        : "Google Drive 連線逾時或暫時中斷，請稍後再試。",
      502, creationStarted ? "drive_creation_unconfirmed" : "drive_connection_failed"
    );
  }
}
