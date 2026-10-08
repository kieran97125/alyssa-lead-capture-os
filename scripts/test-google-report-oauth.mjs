import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const savedEnvironment = { ...process.env };
Object.assign(process.env, {
  GOOGLE_SHEETS_OAUTH_CLIENT_ID: "test-client-id",
  GOOGLE_SHEETS_OAUTH_CLIENT_SECRET: "test-client-secret",
  GOOGLE_SHEETS_OAUTH_TOKEN_ENCRYPTION_KEY: "test-only-encryption-key",
  GOOGLE_SHEETS_OAUTH_REDIRECT_URI: "http://localhost/api/integrations/google-sheets/callback",
});
let authRequest, grantedScopes, row, writes = 0;
class OAuth2Client {
  async generateCodeVerifierAsync() { return { codeVerifier: "v".repeat(40), codeChallenge: "challenge" }; }
  generateAuthUrl(request) { authRequest = request; return "https://accounts.google.com/o/oauth2/auth"; }
  async getToken() { return { tokens: { refresh_token: "test-only-refresh-token", scope: grantedScopes } }; }
  setCredentials() {}
  async getAccessToken() { return { token: "test-only-access-token" }; }
}
const admin = {
  from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
    upsert: async value => { row = { ...value, id: "test-connection-id" }; writes++; return {}; },
    update: () => ({ eq: async () => { writes++; return {}; } }),
  }),
};
const oauthModule = { exports: {} };
const mocks = {
  "server-only": {}, "google-auth-library": { OAuth2Client, CodeChallengeMethod: { S256: "S256" } },
  "@/lib/supabase/admin": { createSupabaseAdminClient: () => admin, hasSupabaseAdminEnv: () => true },
};
new Function("require", "module", "exports", ts.transpileModule(
  readFileSync(new URL("../src/lib/integrations/googleSheetsOAuth.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText)(name => mocks[name] ?? require(name), oauthModule, oauthModule.exports);
const oauth = oauthModule.exports;
function load(path, routeMocks) {
  const routeModule = { exports: {} };
  new Function("require", "module", "exports", ts.transpileModule(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }
  ).outputText)(name => routeMocks[name] ?? require(name), routeModule, routeModule.exports);
  return routeModule.exports;
}
try {
  await oauth.createGoogleSheetsOAuthAuthorizationRequest();
  assert.deepEqual(authRequest.scope, [oauth.GOOGLE_SHEETS_WRITE_SCOPE], "Normal Sheets consent must never expand Drive privileges");
  await oauth.createGoogleSheetsOAuthAuthorizationRequest("reports");
  assert.deepEqual(authRequest.scope, [oauth.GOOGLE_SHEETS_WRITE_SCOPE, oauth.GOOGLE_DRIVE_REPORT_SCOPE]);
  assert.equal(authRequest.prompt, "consent", "Drive grant needs explicit Google consent");
  assert.equal(authRequest.code_challenge_method, "S256");

  const payload = { state: "s".repeat(40), codeVerifier: "v".repeat(40), purpose: "reports" };
  const cookie = oauth.serializeGoogleSheetsOAuthCookie(payload);
  assert.deepEqual(oauth.parseGoogleSheetsOAuthCookie(cookie), payload);
  const chunks = cookie.split(":");
  chunks[2] = Buffer.from(JSON.stringify({ ...payload, purpose: "sheets" })).toString("base64url");
  assert.equal(oauth.parseGoogleSheetsOAuthCookie(chunks.join(":")), null, "Purpose cannot be tampered with after consent starts");
  assert.equal(oauth.parseGoogleSheetsOAuthCookie(oauth.serializeGoogleSheetsOAuthCookie({ state: payload.state, codeVerifier: payload.codeVerifier })).purpose, "sheets", "Existing cookies retain Sheets-only intent");
  assert.equal(oauth.parseGoogleSheetsOAuthCookie(oauth.serializeGoogleSheetsOAuthCookie({ ...payload, purpose: "unapproved" })), null);

  grantedScopes = oauth.GOOGLE_SHEETS_WRITE_SCOPE;
  assert.equal((await oauth.completeGoogleSheetsOAuthAuthorization({ code: "code", codeVerifier: payload.codeVerifier })).ok, true);
  assert.deepEqual(row.scopes, [oauth.GOOGLE_SHEETS_WRITE_SCOPE]);
  assert.ok(!row.refresh_token_encrypted.includes("test-only-refresh-token"));
  let status = await oauth.getGoogleSheetsOAuthStatus();
  assert.equal(status.writeEnabled, true); assert.equal(status.reportDeliveryEnabled, false);
  const existingRow = row, previousWrites = writes;
  await assert.rejects(oauth.getGoogleSheetsOAuthAccessToken({ requireReports: true, recordHealth: false }), /未獲授權/);
  assert.equal(writes, previousWrites); assert.equal(row.status, "connected");
  assert.equal((await oauth.completeGoogleSheetsOAuthAuthorization({ code: "code", codeVerifier: payload.codeVerifier, purpose: "reports" })).ok, false);
  assert.equal(row, existingRow, "Declined Drive grant must preserve working Sheets connection");

  grantedScopes = `${oauth.GOOGLE_SHEETS_WRITE_SCOPE} ${oauth.GOOGLE_DRIVE_REPORT_SCOPE} https://unapproved.example.test/scope`;
  assert.equal((await oauth.completeGoogleSheetsOAuthAuthorization({ code: "code", codeVerifier: payload.codeVerifier })).ok, true);
  assert.deepEqual(row.scopes, [oauth.GOOGLE_SHEETS_WRITE_SCOPE], "Sheets-only intent must not activate Drive, even if Google returns extra previously granted scopes");
  assert.equal((await oauth.completeGoogleSheetsOAuthAuthorization({ code: "code", codeVerifier: payload.codeVerifier, purpose: "reports" })).ok, true);
  assert.deepEqual(row.scopes, [oauth.GOOGLE_SHEETS_WRITE_SCOPE, oauth.GOOGLE_DRIVE_REPORT_SCOPE], "Persist only approved integration scopes");
  status = await oauth.getGoogleSheetsOAuthStatus();
  assert.equal(status.writeEnabled, true); assert.equal(status.reportDeliveryEnabled, true);
  assert.equal(await oauth.getGoogleSheetsOAuthAccessToken({ requireReports: true, recordHealth: false }), "test-only-access-token");

  class NextResponse extends Response {
    cookies = { set: (...values) => { this.cookie = values; } };
    static redirect(url, status = 307) { return new NextResponse(null, { status, headers: { location: String(url) } }); }
  }
  let session = { ok: true, access: { accessLevel: "admin" } }, starts = 0, exchanges = 0, callbackInput;
  const routeMocks = {
    "next/server": { NextResponse }, "next/cache": { revalidatePath: () => {} },
    "@/lib/security/internalAccessServer": { verifyCurrentInternalAccess: async () => session },
    "@/lib/integrations/googleSheetsOAuth": {
      ...oauth, getGoogleSheetsOAuthStatus: async () => ({ tableReady: true }), getMissingGoogleSheetsOAuthConfiguration: () => [],
      createGoogleSheetsOAuthAuthorizationRequest: async purpose => { starts++; return oauth.createGoogleSheetsOAuthAuthorizationRequest(purpose); },
      completeGoogleSheetsOAuthAuthorization: async input => { exchanges++; callbackInput = input; return { ok: true, message: "connected" }; },
    },
    "@/lib/marketing/commandCenter": { MASTER_ACCOUNT_EMAIL: "test-owner@example.test" },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ from: () => ({ insert: async () => ({}) }) }) },
  };
  const start = load("src/app/api/integrations/google-sheets/start/route.ts", routeMocks);
  const callback = load("src/app/api/integrations/google-sheets/callback/route.ts", routeMocks);
  const request = new Request("https://app.example.test/api/integrations/google-sheets/start?purpose=reports", { method: "POST" });
  for (const [query, destination] of [["?purpose=reports", "/reports"], ["?purpose=sheets", "/data-sources"], ["", "/data-sources"]]) {
    const loginRequest = new Request(`https://app.example.test/api/integrations/google-sheets/start${query}`, { method: "POST" });
    for (const masterRequired of [false, true]) {
      session = masterRequired ? { ok: true, access: { accessLevel: "admin" } } : { ok: false };
      const response = await start.POST(loginRequest);
      const location = new URL(response.headers.get("location"), "https://app.example.test");
      assert.equal(response.status, 303);
      assert.equal(location.pathname, "/login");
      assert.equal(location.searchParams.get("next"), destination, "Login must return to the requested integration page");
      assert.equal(location.searchParams.get("error"), masterRequired ? "master_required" : null);
      assert.equal(starts, 0, "Anonymous and staff requests cannot start consent");
    }
  }
  session = { ok: true, access: { accessLevel: "master" } };
  const authorized = await start.POST(request);
  assert.equal(starts, 1);
  assert.deepEqual(authRequest.scope, [oauth.GOOGLE_SHEETS_WRITE_SCOPE, oauth.GOOGLE_DRIVE_REPORT_SCOPE]);
  const signedState = oauth.parseGoogleSheetsOAuthCookie(authorized.cookie[1]);
  assert.equal(signedState.purpose, "reports");
  const callbackRequest = {
    url: "https://app.example.test/api/integrations/google-sheets/callback",
    nextUrl: new URL(`https://app.example.test/api/integrations/google-sheets/callback?state=${signedState.state}&code=test-code&purpose=sheets`),
    cookies: { get: () => ({ value: authorized.cookie[1] }) },
  };
  const completed = await callback.GET(callbackRequest);
  assert.equal(callbackInput.purpose, "reports", "Callback purpose is signed; untrusted query cannot change it");
  assert.ok(completed.headers.get("location").startsWith("https://app.example.test/reports?"));
  session = { ok: true, access: { accessLevel: "admin" } };
  await callback.GET(callbackRequest); assert.equal(exchanges, 1, "Staff cannot complete report consent");

  const MockGenerator = () => null;
  let driveEnabled = true;
  const page = load("src/app/reports/page.tsx", {
    "@/components/alyssa/AppNav": { AppNav: () => null },
    "@/components/reports/ReportGeneratorForm": { ReportGeneratorForm: MockGenerator },
    "@/components/system/SystemButton": { SystemButton: () => null },
    "@/lib/reports/snapshot": { getReportGeneratorOptions: async () => ({ defaultStartDate: "2026-10-01", defaultEndDate: "2026-10-07", brandOptions: [] }) },
    "@/lib/integrations/googleSheetsOAuth": { getGoogleSheetsOAuthStatus: async () => ({ reportDeliveryEnabled: driveEnabled }) },
    "@/lib/security/internalAccessServer": routeMocks["@/lib/security/internalAccessServer"],
  });
  function findElements(node, type) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(child => findElements(child, type));
    return [...(node.type === type ? [node] : []), ...findElements(node.props?.children, type)];
  }
  session = { ok: true, access: { accessLevel: "master" } };
  let element = await page.default({ searchParams: Promise.resolve({}) });
  assert.equal(findElements(element, "form").length, 0, "Connected state stays compact");
  assert.equal(findElements(element, MockGenerator)[0].props.canConnectGoogleDrive, true);
  element = await page.default({ searchParams: Promise.resolve({ reconnect_drive: "1" }) });
  assert.equal(findElements(element, "form")[0].props.action, "/api/integrations/google-sheets/start?purpose=reports", "Revoked token has a reachable Master reconnect action");
  session = { ok: true, access: { accessLevel: "admin" } }; driveEnabled = false;
  element = await page.default({ searchParams: Promise.resolve({ reconnect_drive: "1" }) });
  assert.equal(findElements(element, "form").length, 0, "Query parameters cannot expose consent to staff");
  assert.equal(findElements(element, MockGenerator)[0].props.canConnectGoogleDrive, false);
} finally {
  for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key];
  Object.assign(process.env, savedEnvironment);
}
console.log("PASS: explicit report-only Drive consent, signed purpose, PKCE, scope allowlist, encrypted credential, declined-grant and missing-scope Sheets isolation.");
