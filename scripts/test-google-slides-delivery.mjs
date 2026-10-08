import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
class ReportExportError extends Error {
  constructor(message, status = 400, code = "invalid") { super(message); this.status = status; this.code = code; }
}
function load(path, mocks) {
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", source)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}

let tokenFails = false, renderCalls = 0, tokenOptions, renderSize = 4;
const slides = load("src/lib/reports/googleSlides.ts", {
  "server-only": {},
  "@/lib/integrations/googleSheetsOAuth": {
    getGoogleSheetsOAuthAccessToken: async options => {
      tokenOptions = options; options.signal.throwIfAborted();
      if (tokenFails) throw new Error("authorization missing");
      return "test-only-access-token";
    },
  },
  "@/lib/reports/snapshot": { ReportExportError },
  "@/lib/reports/pptx": { renderReportPptx: async () => { renderCalls++; const bytes = new Uint8Array(renderSize); bytes.set([80, 75, 3, 4]); return bytes; } },
});
const snapshot = {
  generatedAt: "2026-10-07T16:01:00.000Z",
  current: { startDate: "2026-10-01", endDate: "2026-10-07" },
  reportId: "report-1", snapshotId: "snapshot-1",
};
const folderId = slides.REPORT_GOOGLE_DRIVE_FOLDER_ID;
const nativeMime = "application/vnd.google-apps.presentation";
const folder = { id: folderId, mimeType: "application/vnd.google-apps.folder", capabilities: { canAddChildren: true } };
const file = {
  id: "observed-slide-id", name: "2026-10-08_2026-10-01_2026-10-07_CS_AD報數", mimeType: nativeMime, parents: [folderId],
  webViewLink: "https://docs.google.com/presentation/d/observed-slide-id/edit",
};
let requests = [], replies = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  options.signal.throwIfAborted(); requests.push({ url: new URL(url), options });
  const reply = replies.shift();
  if (reply instanceof Error) throw reply;
  assert.ok(reply, "Unexpected Drive request (possible duplicate create)");
  return new Response(JSON.stringify(reply.body), { status: reply.status || 200, headers: reply.headers });
};
const reset = (responses = [{ body: folder }, { body: { id: file.id } }, { body: file }]) => {
  requests = []; replies = responses; renderCalls = 0; tokenFails = false; renderSize = 4;
};
const rejectWith = async code => {
  await assert.rejects(slides.exportReportToGoogleSlides(snapshot), error => error.code === code);
  assert.ok(requests.filter(request => request.options.method === "POST").length <= 1, "Creation must never retry");
};
try {
  reset();
  const result = await slides.exportReportToGoogleSlides(snapshot);
  assert.equal(slides.googleSlidesReportName(snapshot), "2026-10-08_2026-10-01_2026-10-07_CS_AD報數", "Generation date uses HKT");
  assert.deepEqual(result, { id: file.id, name: file.name, url: file.webViewLink, mimeType: nativeMime, folderId, reportId: "report-1", snapshotId: "snapshot-1" });
  assert.equal(tokenOptions.requireReports, true);
  assert.equal(tokenOptions.recordHealth, false, "Report authorization must not damage Sheets connection health");
  assert.equal(requests.length, 3);
  assert.equal(renderCalls, 1);
  const upload = requests[1];
  assert.equal(upload.options.method, "POST");
  assert.equal(upload.url.pathname, "/upload/drive/v3/files");
  assert.equal(upload.url.searchParams.get("uploadType"), "multipart");
  assert.equal(upload.url.searchParams.get("supportsAllDrives"), "true");
  assert.equal(upload.options.redirect, "error", "Bearer tokens must not follow redirects");
  const multipart = upload.options.body.toString();
  assert.ok(multipart.includes(`"mimeType":"${nativeMime}"`));
  assert.ok(multipart.includes(`"parents":["${folderId}"]`));
  assert.ok(multipart.includes("application/vnd.openxmlformats-officedocument.presentationml.presentation"));
  assert.ok(multipart.includes("2026-10-08_2026-10-01_2026-10-07_CS_AD報數"));

  const uploadSession = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=test-session";
  reset([{ body: folder }, { headers: { location: uploadSession } }, { body: { id: file.id } }, { body: file }]);
  renderSize = 5_000_001;
  assert.deepEqual(await slides.exportReportToGoogleSlides(snapshot), result);
  assert.equal(requests.length, 4);
  const initialization = requests[1], completion = requests[2];
  assert.equal(initialization.options.method, "POST");
  assert.equal(initialization.url.searchParams.get("uploadType"), "resumable");
  assert.equal(initialization.options.headers["x-upload-content-length"], String(renderSize));
  assert.deepEqual(JSON.parse(initialization.options.body).parents, [folderId]);
  assert.equal(completion.options.method, "PUT");
  assert.equal(completion.url.href, uploadSession);
  assert.equal(completion.options.body.byteLength, renderSize);
  assert.equal(completion.options.headers["content-length"], String(renderSize));
  assert.equal(requests.filter(request => request.options.method === "POST").length, 1);
  for (const location of ["https://example.test/upload/drive/v3/files?upload_id=evil", "http://www.googleapis.com/upload/drive/v3/files?upload_id=evil", "https://www.googleapis.com/other-path?upload_id=evil", "https://www.googleapis.com/upload/drive/v3/files"]) {
    reset([{ body: folder }, { headers: { location } }]); renderSize = 5_000_001;
    await rejectWith("drive_upload_session_invalid");
    assert.equal(requests.length, 2, "Never send credentials or bytes to an untrusted session URL");
  }
  reset([{ body: folder }, { headers: { location: uploadSession } }, new Error("socket reset")]); renderSize = 5_000_001;
  await rejectWith("drive_creation_unconfirmed");
  assert.equal(requests.length, 3, "Never retry an uncertain completion");

  reset(); tokenFails = true;
  await rejectWith("drive_authorization_required");
  assert.equal(requests.length, 0); assert.equal(renderCalls, 0);
  for (const invalid of [
    { ...folder, id: "other-folder" }, { ...folder, mimeType: nativeMime },
    { ...folder, trashed: true }, { ...folder, capabilities: { canAddChildren: false } },
  ]) {
    reset([{ body: invalid }]); await rejectWith("drive_folder_not_writable"); assert.equal(renderCalls, 0);
  }
  reset([{ status: 403, body: { error: { errors: [{ reason: "insufficientPermissions" }] } } }]);
  await rejectWith("drive_authorization_required");
  reset([{ status: 404, body: { error: {} } }]); await rejectWith("drive_folder_access_required");
  reset([{ body: folder }, { status: 500, body: { error: {} } }]); await rejectWith("drive_create_failed");
  reset([{ body: folder }, new Error("socket reset")]); await rejectWith("drive_creation_unconfirmed");
  for (const invalid of [
    { ...file, parents: ["other-folder"] }, { ...file, mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
    { ...file, webViewLink: "https://example.test/presentation/d/observed-slide-id/edit" },
    { ...file, webViewLink: "https://docs.google.com/presentation/d/other-id/edit" },
    { ...file, trashed: true }, { ...file, name: "" },
  ]) {
    reset([{ body: folder }, { body: { id: file.id } }, { body: invalid }]); await rejectWith("drive_verification_failed");
  }
  reset([{ body: folder }, { body: { id: file.id } }, { status: 500, body: { error: {} } }]);
  await rejectWith("drive_verify_failed");
  reset();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(slides.exportReportToGoogleSlides(snapshot, { signal: controller.signal }), error => error.code === "drive_connection_failed");
  assert.equal(requests.length, 0);

  let allowed = true, delivered = 0;
  const route = load("src/app/api/internal/reports/export/route.ts", {
    "next/server": { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), { ...init, headers: { ...init.headers, "content-type": "application/json" } }) } },
    "@/lib/security/internalAccessServer": { requireModuleAccess: async () => ({ allowed }) },
    "@/lib/reports/snapshot": { ReportExportError, normalizeReportExportRequest: input => ({ ...input, format: input.format === "pptx" ? "google_slides" : input.format }), buildReportSnapshot: async () => snapshot },
    "@/lib/reports/googleSlides": { exportReportToGoogleSlides: async (_snapshot, options) => { assert.ok(options.signal); delivered++; return result; } },
  });
  const request = format => new Request("https://app.example.test/api/internal/reports/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format }) });
  for (const format of ["google_slides", "pptx"]) {
    const response = await route.POST(request(format));
    assert.equal(response.status, 201); assert.equal(response.headers.get("content-disposition"), null);
    assert.equal(response.headers.get("x-report-snapshot-id"), snapshot.snapshotId);
    assert.deepEqual(await response.json(), { format: "google_slides", presentation: result });
  }
  allowed = false;
  assert.equal((await route.POST(request("google_slides"))).status, 403);
  assert.equal(delivered, 2, "Unauthorized request must not create a file");
} finally { globalThis.fetch = originalFetch; }
console.log("PASS: native Slides conversion, HKT naming, folder/MIME/URL verification, bounded cancellation, safe scope failures, single creation, authenticated JSON API.");
