import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";

// All provider calls are mocked. The installed OAuth/Gaxios SDK still executes
// so cancellation and retry behavior are tested against its actual API.
const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const originalFetch = globalThis.fetch;
const envNames = ["GOOGLE_SHEETS_OAUTH_CLIENT_ID", "GOOGLE_SHEETS_OAUTH_CLIENT_SECRET",
  "GOOGLE_SHEETS_OAUTH_REDIRECT_URI", "GOOGLE_SHEETS_OAUTH_TOKEN_ENCRYPTION_KEY"];
const originalEnv = envNames.map((name) => process.env[name]);
for (const name of envNames) process.env[name] = "synthetic-test-value";
process.env.GOOGLE_SHEETS_OAUTH_REDIRECT_URI = "https://example.test/api/integrations/google-sheets/callback";
const iv = Buffer.alloc(12, 1);
const cipher = createCipheriv("aes-256-gcm", createHash("sha256")
  .update(process.env.GOOGLE_SHEETS_OAUTH_TOKEN_ENCRYPTION_KEY).digest(), iv);
const encrypted = Buffer.concat([cipher.update("synthetic-refresh-token", "utf8"), cipher.final()]);
const connection = {
  id: "synthetic-connection", status: "connected",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  refresh_token_encrypted: ["gsoauth:v1", iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(":"),
};
const configuration = { spreadsheetId: "synthetic_sheet_id_12345", tabName: "lead" };
const brands = [{ id: "gos", name: "GOS Beauty", slug: "gos-beauty", primary_color: null }];
const headers = ["Created At", "最後更新日期", "跟進狀態", "品牌", "Account", "電話", "確認到店日期", "預約日期", "療程項目"];
const rows = [["2026-10-01", "2026-10-02", "已到店", "GOS Beauty", "GOS Beauty", "10000001", "2026-10-03", "2026-10-03", "Synthetic Treatment"]];
let dbWrites = 0;
let tokenCalls = 0;
let sheetCalls = [];
let tokenMode = "success";
let connectionMode = "success";
let sheetMode = "success";
let activeController;
let readSignal;
let sdkSignal;

function stalled(signal) {
  assert.ok(signal instanceof AbortSignal, "Provider work must receive a real abort signal");
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    queueMicrotask(() => activeController.abort());
  });
}
function database() {
  return { from(table) {
    let writing = false;
    let signal;
    const query = {
      select() { return query; }, eq() { return query; }, neq() { return query; },
      order() { return query; }, in() { return query; }, gte() { return query; },
      lte() { return query; }, maybeSingle() { return query; },
      abortSignal(value) { signal = value; return query; },
      update() { writing = true; return query; },
      then(resolve, reject) {
        if (writing) { dbWrites++; return Promise.resolve({ error: null }).then(resolve, reject); }
        if (table === "google_sheets_oauth_connections") {
          readSignal = signal;
          if (connectionMode === "stall") return stalled(signal).then(resolve, reject);
          return Promise.resolve({ data: connection, error: null }).then(resolve, reject);
        }
        const data = table === "brands" ? brands : {
          id: "synthetic-source", display_name: "Synthetic Sheet", status: "connected", configuration,
        };
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
}
class OfflineOAuthClient extends OAuth2Client {
  constructor(options) {
    super({ ...options, transporterOptions: { ...options.transporterOptions,
      fetchImplementation: async (url, init) => {
        tokenCalls++;
        sdkSignal = init.signal;
        if (tokenMode === "stall") return stalled(init.signal);
        if (tokenMode === "failure") return new Response(JSON.stringify({ error: "temporarily_unavailable" }), { status: 503 });
        return new Response(JSON.stringify({ access_token: "synthetic-access-token", expires_in: 3600 }),
          { status: 200, headers: { "content-type": "application/json" } });
      },
    } });
  }
}
globalThis.fetch = async (url, init) => {
  sheetCalls.push({ url: new URL(url), init });
  if (sheetMode === "stall") return stalled(init.signal);
  if (sheetMode === "body-stall") {
    return { ok: true, json: () => stalled(init.signal) };
  }
  return new Response(JSON.stringify({ valueRanges: [{ values: [headers] }, { values: rows }] }),
    { status: 200, headers: { "content-type": "application/json" } });
};
const mocks = {
  "server-only": {},
  "google-auth-library": { OAuth2Client: OfflineOAuthClient, CodeChallengeMethod },
  "@/lib/supabase/admin": { createSupabaseAdminClient: database, hasSupabaseAdminEnv: () => true },
  "@/lib/integrations/metaLeadFormSheetNormalizer": {
    normalizeMetaLeadFormRows: () => ({ rows,
      rewrites: [{ rowNumber: 2, values: Array(22).fill("synthetic"), leadId: "synthetic" }] }),
  },
};
const modules = new Map();
function load(relativePath) {
  if (modules.has(relativePath)) return modules.get(relativePath).exports;
  const loadedModule = { exports: {} };
  modules.set(relativePath, loadedModule);
  const compiled = ts.transpileModule(readFileSync(`${root}${relativePath}`, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    fileName: relativePath,
  });
  const require = (name) => Object.hasOwn(mocks, name) ? mocks[name]
    : name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : nativeRequire(name);
  new Function("require", "module", "exports", compiled.outputText)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const table = load("src/lib/integrations/googleSheetsLeadTable.ts");
function reset() {
  dbWrites = 0; tokenCalls = 0; sheetCalls = [];
  tokenMode = "success"; connectionMode = "success"; sheetMode = "success";
  activeController = new AbortController();
}
try {
  reset();
  const readOnlyTable = await table.readLiveLeadTable(configuration, { readOnly: true });
  assert.deepEqual(readOnlyTable.rows, rows);
  assert.equal(dbWrites, 0, "Read-only gateway must not persist OAuth health");
  assert.equal(sheetCalls.length, 1, "Read-only gateway reads once and must not normalize/write the Sheet");
  assert.equal(sheetCalls[0].init.method ?? "GET", "GET");
  assert.deepEqual(sheetCalls[0].url.searchParams.getAll("ranges"), ["'lead'!A1:Y1", "'lead'!A2:Y5000"]);
  assert.equal(sheetCalls[0].url.searchParams.get("valueRenderOption"), "UNFORMATTED_VALUE");
  assert.equal(sheetCalls[0].url.searchParams.get("dateTimeRenderOption"), "SERIAL_NUMBER");
  assert.ok(readSignal instanceof AbortSignal);
  assert.equal(sdkSignal, readSignal);
  assert.equal(sheetCalls[0].init.signal, readSignal, "One deadline spans DB, token and Sheet response/body");

  // Advance the provider deadline immediately instead of sleeping for 12 s.
  // This also exercises the gateway's safe failure result, without supplying
  // a caller AbortSignal that could hide an absent built-in deadline.
  reset();
  sheetMode = "stall";
  const nativeTimeout = AbortSignal.timeout;
  AbortSignal.timeout = (milliseconds) => {
    assert.equal(milliseconds, 12_000);
    return activeController.signal;
  };
  try {
    await assert.rejects(table.readLiveLeadTable(configuration, { readOnly: true }), /Lead Sheet 讀取逾時/);
    assert.equal(dbWrites, 0);
    assert.equal(sheetCalls.length, 1);
  } finally {
    AbortSignal.timeout = nativeTimeout;
  }

  for (const stage of ["connection", "token", "sheet", "body"]) {
    reset();
    if (stage === "connection") connectionMode = "stall";
    if (stage === "token") tokenMode = "stall";
    if (stage === "sheet") sheetMode = "stall";
    if (stage === "body") sheetMode = "body-stall";
    await assert.rejects(table.readLiveLeadTable(configuration, { readOnly: true, signal: activeController.signal }), /Lead Sheet 讀取逾時/);
    assert.equal(dbWrites, 0, `${stage}: cancellation must not mark provider disconnected or persist health`);
    assert.equal(tokenCalls, stage === "connection" ? 0 : 1, `${stage}: no OAuth retry after cancellation`);
    assert.equal(sheetCalls.length, ["sheet", "body"].includes(stage) ? 1 : 0, `${stage}: no later provider stage runs`);
  }

  reset();
  tokenMode = "failure";
  await assert.rejects(table.readLiveLeadTable(configuration, { readOnly: true }));
  assert.equal(tokenCalls, 1, "Scoped token reads must not retry 503 in the request path");
  assert.equal(dbWrites, 0, "Transient token failure must not mutate connection health during GET");
  assert.equal(sheetCalls.length, 0);

  reset();
  const liveTable = await table.readLiveLeadTable(configuration);
  await table.normalizeMetaLeadRowsInLiveTable({ configuration, liveTable, brands, writeBack: true });
  assert.equal(dbWrites, 2, "Explicit sync retains successful OAuth health updates");
  assert.deepEqual(sheetCalls.map(({ url, init }) => [url.pathname.split("/").at(-1), init.method ?? "GET"]),
    [["values:batchGet", "GET"], ["values:batchUpdate", "POST"], ["values:batchClear", "POST"]]);
  console.log("PASS: standalone read-only Google gateway, one batch read, shared abort at 4 stages, no token retries, explicit sync preserved");
} finally {
  globalThis.fetch = originalFetch;
  envNames.forEach((name, index) => {
    if (originalEnv[index] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[index];
  });
}
