import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const actorId = "00000000-0000-4000-8000-000000000001";
let access = { allowed: true, access: { source: "supabase_auth", accessLevel: "master", memberId: actorId } };
let authError = false;
let configured = true;
let rpcResult = { data: 3, error: null };
let rpcThrows = false;
let deferThrows = false;
let workerThrows = false;
const rpcCalls = [], deferred = [], workerCalls = [], revalidated = [], redirects = [], warnings = [];
const module = { exports: {} };
const mocks = {
  "next/server": { after: callback => { if (deferThrows) throw new Error("synthetic"); deferred.push(callback); } },
  "next/cache": { revalidatePath: path => revalidated.push(path) },
  "next/navigation": { redirect: location => { redirects.push(location); throw Object.assign(new Error("redirect"), { location }); } },
  "@/lib/security/internalAccessServer": { requireModuleAccess: async key => { assert.equal(key, "system_audit"); if (authError) throw new Error("private provider payload"); return access; } },
  "@/lib/supabase/admin": {
    hasSupabaseAdminEnv: () => configured,
    createSupabaseAdminClient: () => ({ rpc: async (name, args) => { rpcCalls.push({ name, args }); if (rpcThrows) throw new Error("private database payload"); return rpcResult; } }),
  },
  "@/lib/capture/leadDelivery": { processPublicLeadDeliveries: async input => { workerCalls.push(input); if (workerThrows) throw new Error("private delivery destination"); } },
};
const source = readFileSync(new URL("../src/app/system-audit/actions.ts", import.meta.url), "utf8");
new Function("require", "module", "exports", ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(name => mocks[name] ?? require(name), module, module.exports);
const { getLeadDeliveryRecoveryAccess, recheckLeadDeliveriesAction } = module.exports;
const warn = console.warn;
console.warn = (...args) => warnings.push(args);
async function run(expectedStatus, expectedCount) {
  const before = redirects.length;
  const forged = new FormData(); forged.set("actor_id", "forged"); forged.set("limit", "100000");
  await assert.rejects(recheckLeadDeliveriesAction(forged), error => {
    const url = new URL(error.location, "https://internal.example.test");
    assert.equal(url.pathname, "/system-audit");
    assert.equal(url.searchParams.get("delivery_recheck"), expectedStatus);
    assert.equal(url.searchParams.get("delivery_count"), expectedCount === undefined ? null : String(expectedCount));
    assert.ok(!error.location.includes("private"));
    return true;
  });
  assert.equal(redirects.length, before + 1, "Framework redirect is issued once, not caught as a provider failure");
}
try {
  assert.deepEqual(await getLeadDeliveryRecoveryAccess(), { allowed: true }, "UI availability must never expose the actor UUID");
  for (const denied of [
    { allowed: false, access: { source: "supabase_auth", accessLevel: "admin", memberId: actorId } },
    { allowed: true, access: { source: "supabase_auth", accessLevel: "admin", memberId: actorId } },
  ]) {
    access = denied; await run("forbidden");
  }
  for (const unsupported of [
    { source: "shared_password", accessLevel: "master" },
    { source: "development_not_configured", accessLevel: "master" },
    { source: "supabase_auth", accessLevel: "master", memberId: "invalid" },
    { source: "supabase_auth", accessLevel: "master" },
  ]) {
    access = { allowed: true, access: unsupported };
    assert.deepEqual(await getLeadDeliveryRecoveryAccess(), { allowed: false, reason: "member_required" });
    await run("member_required");
  }
  authError = true; await run("unavailable"); authError = false;
  access = { allowed: true, access: { source: "supabase_auth", accessLevel: "master", memberId: actorId } };
  configured = false; await run("unavailable"); configured = true;
  assert.equal(rpcCalls.length, 0, "No unauthorized, unsupported or unavailable request reaches privileged RPC");

  for (const data of [null, "3", -1, 11, 0.5]) { rpcResult = { data, error: null }; await run("failed"); }
  rpcResult = { data: 3, error: { message: "private provider payload" } }; await run("failed");
  rpcThrows = true; await run("failed"); rpcThrows = false;
  assert.equal(deferred.length, 0); assert.equal(revalidated.length, 0);

  rpcResult = { data: 3, error: null };
  await run("scheduled", 3);
  assert.deepEqual(rpcCalls.at(-1), { name: "recheck_public_lead_deliveries", args: { p_actor_id: actorId, p_limit: 10 } }, "Actor and bounded budget are server-selected");
  assert.deepEqual(revalidated, ["/system-audit"]);
  assert.equal(workerCalls.length, 0, "Worker runs after the accepted request, not while submitting the action");
  assert.equal(deferred.length, 1); await deferred.shift()();
  assert.deepEqual(workerCalls, [{ limit: 3 }]);

  rpcResult = { data: 0, error: null }; await run("scheduled", 0);
  assert.equal(deferred.length, 0, "Empty recheck does not start unrelated delivery work");
  rpcResult = { data: 2, error: null }; workerThrows = true;
  await run("scheduled", 2); await deferred.shift()();
  deferThrows = true; await run("scheduled", 2);
  assert.ok(warnings.every(args => args.length === 1 && /^lead_delivery_recheck_/.test(args[0])), "Worker/deferred failure diagnostics exclude provider payloads");
} finally { console.warn = warn; }
console.log("PASS: master module permission plus verified member UUID; no fabricated password actor; fixed bounded audited recheck RPC; deferred worker; safe feedback; failure/no-work behavior.");
