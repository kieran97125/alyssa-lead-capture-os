import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const transpile = code => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const moduleFrom = code => import(`data:text/javascript;base64,${Buffer.from(transpile(code)).toString("base64")}`);
const model = await moduleFrom(fs.readFileSync("src/lib/workbench/resources.ts", "utf8"));
assert.equal(model.driveFileId("https://drive.google.com/drive/u/0/folders/approved-test-root_"), "approved-test-root_");
assert.equal(model.driveFileId("https://drive.google.com.attacker.example/drive/folders/approved-test-root_"), null);
assert.equal(model.driveFileId("https://example.com/?id=approved-test-root_"), null);
assert.equal(model.driveFileId("javascript:alert(1)"), null);
assert.equal(model.driveFileId("https://docs.google.com/spreadsheets/d/synthetic-workbook/edit"), "synthetic-workbook");
assert.equal(model.contentIndexable("application/vnd.google-apps.spreadsheet"), false);
assert.equal(model.contentIndexable("video/mp4"), false);
assert.equal(model.contentIndexable("application/pdf"), true);
assert.deepEqual(model.resourceNodes(["creative"], [{ fileId: "folder-ib", nodeIds: ["ib", "creative"] }], ["root", "folder-ib"]), ["creative", "ib"]);
class DriveReadError extends Error { constructor(status) { super("Google 暫時未能讀取"); this.status = status; } }
let committed, calls = [], fail = true;
const pendingRows = [];
const db = {
 rpc: async (_name, body) => { committed = structuredClone(body); return { data: true }; },
 from: () => { const chain = { select: () => chain, eq: () => chain, limit: async () => ({ data: pendingRows.splice(0, 3) }) }; return chain; },
};
const source = { id: "source", owner_member_id: "owner", drive_file_id: "root", label: "素材", kind: "folder", node_ids: ["creative"], folder_bindings: [{ fileId: "folder-ib", nodeIds: ["ib"] }], content_mode: "documents", cursor: {}, lease_token: "lease" };
globalThis.workbenchResourceTest = { createSupabaseAdminClient: () => db, ...model, DriveReadError,
 getDriveFile: async () => ({ id: "root", name: "素材", mimeType: "application/vnd.google-apps.folder" }),
 listDriveFolder: async (_token, id, token) => {
  calls.push([id, token]);
  if (id === "root" && !token) return { files: [{ id: "folder-ib", name: "IB", mimeType: "application/vnd.google-apps.folder" }], nextPageToken: "page-2" };
  if (id === "root" && token === "page-2") { if (fail) { fail = false; throw new Error("interrupted"); } return { files: [{ id: "sheet", name: "管理表", mimeType: "application/vnd.google-apps.spreadsheet" }] }; }
  if (id === "folder-ib") return { files: [{ id: "brief", name: "肩頸拍攝", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-11-11T00:00:00Z" }] };
  throw new Error("unexpected provider call");
 }, readDriveText: async () => ({ text: "穴位拍攝流程", state: "indexed" }), driveToken: async () => "test-token" };
let code = fs.readFileSync("src/lib/workbench/resourceSync.ts", "utf8").replace(/^import .*;\s*$/gm, "");
code = `const { createSupabaseAdminClient,contentIndexable,resourceNodes,safeDriveUrl,DriveReadError,getDriveFile,listDriveFolder,readDriveText,driveToken } = globalThis.workbenchResourceTest;\n${code}\nexport { step };`;
const sync = await moduleFrom(code);
await sync.step(source, "test-token", Date.now() + 100000);
assert.equal(committed.p_status, "error");
assert.equal(committed.p_prune, false, "incomplete traversal must not delete existing mounts");
assert.equal(committed.p_cursor.queue[0].pageToken, "page-2");
source.cursor = committed.p_cursor;
await sync.step(source, "test-token", Date.now() + 100000);
assert.equal(committed.p_prune, true);
assert.deepEqual(calls, [["root", undefined], ["root", "page-2"], ["root", "page-2"], ["folder-ib", undefined]]);
assert.deepEqual(committed.p_mounts.find(m => m.file_id === "brief").node_ids, ["creative", "ib"]);
assert.equal(committed.p_files.find(f => f.file_id === "sheet").indexable, false, "management rows must not enter content index");
assert.equal(committed.p_files.find(f => f.file_id === "brief").web_url, "https://docs.google.com/document/d/brief/edit");
source.cursor = committed.p_cursor;
pendingRows.push({ workbench_resource_files: { file_id: "brief", mime_type: "application/vnd.google-apps.document", content_version: "v1", size: null } });
await sync.step(source, "test-token", Date.now() + 100000);
assert.equal(committed.p_texts[0].text_content, "穴位拍攝流程");
source.cursor = committed.p_cursor;
await sync.step(source, "test-token", Date.now() + 100000);
assert.equal(committed.p_complete, true);
assert.equal(committed.p_status, "ready");
delete globalThis.workbenchResourceTest;
console.log("Resource qualification passed: approved URL parsing, CJK-ready scope model, metadata-only Sheets, checkpointed pagination, retry, nested mapping, content and completion.");
