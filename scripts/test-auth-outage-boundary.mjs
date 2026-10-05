import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server.js";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, stubs = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: path,
  });
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled.outputText)(
    (name) => Object.hasOwn(stubs, name) ? stubs[name] : require(name), loaded, loaded.exports,
  );
  return loaded.exports;
}
const deadline = load("src/lib/supabase/requestDeadline.ts");
const permissions = load("src/lib/security/workspacePermissions.ts");
const authConfig = load("src/lib/supabase/authConfig.ts");
const identity = { userId: "synthetic-user", email: "synthetic@example.invalid" };
const member = { id: "synthetic-member", auth_user_id: identity.userId, email: identity.email, workspace_role: "marketer", status: "active", is_master: false };

function workspaceFixture(respond) {
  const requests = [];
  const client = createClient("https://synthetic.invalid", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const request = { url: new URL(String(input)), method: init.method, signal: init.signal };
      requests.push(request);
      return respond(request);
    } },
  });
  const workspace = load("src/lib/security/workspaceAuth.ts", {
    "server-only": {},
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => client },
    "@/lib/supabase/requestDeadline": { ...deadline, createAuthRequestDeadline: () => deadline.createAuthRequestDeadline({ timeoutMs: 60 }) },
    "@/lib/security/workspacePermissions": permissions,
  });
  return { workspace, requests };
}
const json = (body, init) => new Response(JSON.stringify(body), init);
const normalResponse = (request) => json(request.url.pathname.endsWith("/workspace_members") ? [member]
  : request.url.pathname.endsWith("/workspace_member_brand_access") ? [{ brand_id: "permitted-brand", status: "active" }]
  : [{ module_key: "dashboard", can_access: true }, { module_key: "settings", can_access: false }]);

test("workspace access retains exact allowed brands and module denials", async () => {
  const { workspace } = workspaceFixture(normalResponse);
  const result = await workspace.getWorkspaceMemberAccess(identity);
  assert.deepEqual(result.brandIds, ["permitted-brand"]);
  assert.equal(workspace.canAccessWorkspaceModule(result, "dashboard"), true);
  assert.equal(workspace.canAccessWorkspaceModule(result, "settings"), false);
  assert.equal(result.isMaster, false);
});

test("missing, suspended, removed, mismatched members remain genuine denials", async () => {
  for (const candidate of [null, { ...member, status: "suspended" }, { ...member, status: "removed" }, { ...member, auth_user_id: "different" }, { ...member, email: "different@example.invalid" }]) {
    const { workspace, requests } = workspaceFixture(() => json(candidate ? [candidate] : []));
    assert.equal(await workspace.getWorkspaceMemberAccess(identity, { activate: true }), null);
    assert.ok(requests.every((request) => request.method === "GET"));
  }
});

test("HTTP503 with long Retry-After fails immediately without SDK retries or uninvited result", async () => {
  const { workspace, requests } = workspaceFixture(() => json({ message: "synthetic outage" }, { status: 503, headers: { "retry-after": "86400" } }));
  await assert.rejects(workspace.getWorkspaceMemberAccess(identity), workspace.WorkspaceAccessUnavailableError);
  assert.equal(requests.length, 1);
});

test("permission lookup faults fail closed even for a valid member", async () => {
  const { workspace } = workspaceFixture((request) => request.url.pathname.endsWith("/workspace_member_brand_access")
    ? json({ message: "synthetic outage" }, { status: 503 }) : normalResponse(request));
  await assert.rejects(workspace.getWorkspaceMemberAccess(identity), workspace.WorkspaceAccessUnavailableError);
});

test("invitation activation is awaited, bounded and never automatically retried", async () => {
  const { workspace, requests } = workspaceFixture((request) => request.method === "PATCH"
    ? new Promise(() => {}) : json([{ ...member, status: "invited" }]));
  await assert.rejects(workspace.getWorkspaceMemberAccess(identity, { activate: true }), workspace.WorkspaceAccessUnavailableError);
  assert.equal(requests.filter((request) => request.method === "PATCH").length, 1);
  assert.equal(requests.at(-1).signal.aborted, true);
  assert.equal(requests.length, 2, "never continue to permission reads or return access after activation timeout");
});

function proxyFixture({ authOutage = false, memberOutage = false, breakGlass = false, validSigned = false, signedLevel = "admin" } = {}) {
  const rotated = NextResponse.next();
  rotated.cookies.set("sb-synthetic-auth-token", "rotated", { httpOnly: true, sameSite: "lax" });
  const workspace = workspaceFixture(normalResponse).workspace;
  const loaded = load("src/proxy.ts", {
    "next/server": { NextResponse },
    "@/lib/attribution/publicAttributionCookie": {},
    "@/lib/security/routeBoundary": load("src/lib/security/routeBoundary.ts"),
    "@/lib/security/internalAccess": {
      adminSessionCookieName: "synthetic-admin",
      isAdminPasswordGateEnabled: () => true,
      verifySignedAdminSession: async () => ({ ok: validSigned, source: "shared_password", accessLevel: signedLevel }),
    },
    "@/lib/supabase/authConfig": { getSupabasePublicAuthConfig: () => ({ ready: true }), isWorkspaceEmailAuthRequired: () => true, isBreakGlassPasswordEnabled: () => breakGlass },
    "@/lib/supabase/authProxy": { hasSupabaseAuthCookie: () => true, refreshSupabaseAuth: async () => ({ response: rotated, identity: authOutage ? null : identity, unavailable: authOutage }) },
    "@/lib/security/workspaceAuth": {
      ...workspace,
      getWorkspaceMemberAccess: async () => { if (memberOutage) throw new workspace.WorkspaceAccessUnavailableError(); return null; },
    },
  });
  return { proxy: loaded.proxy, rotated };
}

test("Proxy auth/member outages redirect with preserved rotated cookies and sanitized next", async () => {
  for (const flags of [{ authOutage: true }, { memberOutage: true }]) {
    const { proxy } = proxyFixture(flags);
    const response = await proxy(new NextRequest("https://synthetic.invalid/dashboard?brandId=permitted-brand"));
    const target = new URL(response.headers.get("location"));
    assert.equal(target.pathname, "/login");
    assert.equal(target.searchParams.get("error"), "auth_unavailable");
    assert.equal(target.searchParams.get("next"), "/dashboard?brandId=permitted-brand");
    assert.equal(response.cookies.get("sb-synthetic-auth-token").value, "rotated");
    assert.equal(response.cookies.get("sb-synthetic-auth-token").httpOnly, true);
  }
});

test("outage never opens fallback; explicit breakglass still requires signature and master constraints", async () => {
  for (const flags of [{ breakGlass: false, validSigned: true }, { breakGlass: true, validSigned: false }]) {
    const { proxy } = proxyFixture({ authOutage: true, ...flags });
    const response = await proxy(new NextRequest("https://synthetic.invalid/dashboard"));
    assert.equal(new URL(response.headers.get("location")).searchParams.get("error"), "auth_unavailable");
  }
  const permitted = proxyFixture({ authOutage: true, breakGlass: true, validSigned: true });
  assert.equal(await permitted.proxy(new NextRequest("https://synthetic.invalid/dashboard")), permitted.rotated);
  const denied = await permitted.proxy(new NextRequest("https://synthetic.invalid/data-sources"));
  assert.equal(new URL(denied.headers.get("location")).searchParams.get("error"), "master_required");
});

test("server access does not turn provider errors or configured invalid sessions into open access", async () => {
  const workspace = workspaceFixture(normalResponse).workspace;
  for (const outage of [false, true]) {
    const internal = load("src/lib/security/internalAccessServer.ts", {
      "next/headers": { cookies: async () => ({ get: () => undefined }) },
      react: { cache: (fn) => fn },
      "@/lib/supabase/admin": {},
      // The real verifier returns this in an unconfigured development setup;
      // it is not a signed emergency session and cannot bypass configured Auth.
      "@/lib/security/internalAccess": { isAdminPasswordGateEnabled: () => false, verifySignedAdminSession: async () => ({ ok: true, source: "development_not_configured", accessLevel: "master" }) },
      "@/lib/supabase/authConfig": { getSupabasePublicAuthConfig: () => ({ ready: true }), isWorkspaceEmailAuthRequired: () => false, isBreakGlassPasswordEnabled: () => true },
      "@/lib/supabase/authServer": { createSupabaseServerAuthClient: async () => ({ authDeadline: { run: (fn) => fn() }, auth: { getClaims: async () => ({ data: null, error: { name: outage ? "AuthRetryableFetchError" : "AuthApiError", status: outage ? 0 : 401 } }) } }) },
      "@/lib/supabase/requestDeadline": deadline,
      "@/lib/security/workspaceAuth": workspace,
      "@/lib/security/workspacePermissions": permissions,
    });
    if (outage) await assert.rejects(internal.getCurrentInternalAccess(), workspace.WorkspaceAccessUnavailableError);
    else {
      assert.equal((await internal.getCurrentInternalAccess()).source, "unauthenticated");
      assert.equal((await internal.requireModuleAccess("dashboard")).allowed, false);
    }
  }
});

function finalizeFixture({ serviceError = false, invalid = false, missingMember = false, memberError = false } = {}) {
  let signOuts = 0;
  let writes = 0;
  const deferred = [];
  const workspace = workspaceFixture(normalResponse).workspace;
  const authClient = { authDeadline: { run: (fn) => fn() }, auth: {
    getUser: async () => ({ data: { user: invalid ? null : { id: identity.userId, email: identity.email } }, error: serviceError ? { name: "AuthRetryableFetchError", status: 0 } : null }),
    signOut: async () => { signOuts++; },
  } };
  const pendingWrite = { update() { return this; }, insert() { return this; }, eq() { return this; }, abortSignal() { return this; }, then() { writes++; return new Promise(() => {}); } };
  const loaded = load("src/app/api/auth/finalize/route.ts", {
    "next/server": { NextResponse, after: (fn) => deferred.push(fn) },
    "@/lib/supabase/authServer": { createSupabaseServerAuthClient: async () => authClient },
    "@/lib/supabase/admin": { createSupabaseAdminClient: () => ({ from: () => pendingWrite }) },
    "@/lib/supabase/authConfig": authConfig,
    "@/lib/security/workspaceAuth": { getWorkspaceMemberAccess: async () => { if (memberError) throw new workspace.WorkspaceAccessUnavailableError(); return missingMember ? null : { memberId: member.id, email: identity.email, workspaceRole: "marketer" }; } },
    "@/lib/supabase/requestDeadline": deadline,
  });
  return { run: () => loaded.POST(new Request("https://synthetic.invalid/api/auth/finalize", { method: "POST", body: JSON.stringify({ next: "/dashboard?brandId=permitted-brand" }) })), get signOuts() { return signOuts; }, get writes() { return writes; }, deferred };
}

test("finalize distinguishes service503 from invalid401 and genuine denied403 without signing out on service failures", async () => {
  for (const flags of [{ serviceError: true }, { memberError: true }]) {
    const fixture = finalizeFixture(flags);
    const response = await fixture.run();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, "auth_unavailable");
    assert.equal(fixture.signOuts, 0);
  }
  assert.equal((await finalizeFixture({ invalid: true }).run()).status, 401);
  const denied = finalizeFixture({ missingMember: true });
  assert.equal((await denied.run()).status, 403);
  assert.equal(denied.signOuts, 1);
});

test("successful finalize does not wait for sign-in telemetry and retains scoped next URL", async () => {
  const fixture = finalizeFixture();
  const response = await fixture.run();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).redirectTo, "/dashboard?brandId=permitted-brand");
  assert.equal(fixture.deferred.length, 1);
  assert.equal(fixture.writes, 0);
});

test("confirmation service failure is transient; unmount suppresses late navigation without OTP replay", async () => {
  for (const unmount of [false, true]) {
    const previousWindow = globalThis.window;
    const previousFetch = globalThis.fetch;
    const states = [];
    const navigations = [];
    let otpCalls = 0;
    let cleanup;
    let finishFetch;
    globalThis.window = { location: { hash: "", pathname: "/auth/confirm", search: "", replace: (url) => navigations.push(url) } };
    globalThis.fetch = () => new Promise((resolve) => { finishFetch = resolve; });
    try {
      const confirm = load("src/components/auth/AuthConfirmClient.tsx", {
        react: { useEffect: (effect) => { cleanup = effect(); }, useState: (initial) => [initial, (value) => states.push(value)] },
        "@/lib/supabase/authBrowser": { createSupabaseBrowserAuthClient: () => ({ auth: { verifyOtp: async () => { otpCalls++; return { error: null }; } } }) },
        "@/lib/supabase/authConfig": authConfig,
        "@/lib/supabase/requestDeadline": deadline,
      });
      confirm.AuthConfirmClient({ code: "", next: "/dashboard", tokenHash: "synthetic", type: "invite" });
      await new Promise((resolve) => setImmediate(resolve));
      if (unmount) cleanup();
      finishFetch(unmount ? json({ ok: true, redirectTo: "/dashboard" }) : new Response("<html>Unavailable</html>", { status: 503 }));
      await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(navigations, []);
      assert.equal(otpCalls, 1);
      if (unmount) assert.deepEqual(states, []);
      else {
        assert.equal(states[0], true);
        assert.match(states[1], /暫時/);
        assert.doesNotMatch(states[1], /過期/);
      }
    } finally {
      cleanup?.();
      globalThis.window = previousWindow;
      globalThis.fetch = previousFetch;
    }
  }
});
