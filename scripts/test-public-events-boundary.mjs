import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(filename, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}

const boundary = load("src/lib/attribution/publicEvents.ts");
const { leadEventTypes } = load("src/lib/attribution/types.ts");
let envReady = true;
let adminCalls = 0;
let envChecks = 0;
let insertError = null;
const inserted = [];
const route = load("src/app/api/public/events/route.ts", {
  "next/server": { NextResponse: { json: (body, options) => Response.json(body, options) } },
  "@/lib/attribution/publicEvents": boundary,
  "@/lib/supabase/admin": {
    hasSupabaseAdminEnv: () => { envChecks++; return envReady; },
    createSupabaseAdminClient: () => {
      adminCalls++;
      return { from: table => ({ insert: async row => { assert.equal(table, "lead_events"); inserted.push(row); return { error: insertError }; } }) };
    },
  },
});
function request(payload, headers = {}) {
  return new Request("https://public.example.test/api/public/events", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(payload),
  });
}
async function reject(payload, error, status = 400) {
  const beforeAdmin = adminCalls;
  const beforeEnv = envChecks;
  const result = await route.POST(request(payload));
  assert.equal(result.status, status);
  assert.equal((await result.json()).error, error);
  assert.equal(adminCalls, beforeAdmin, "Rejected public events cannot instantiate an admin client");
  assert.equal(envChecks, beforeEnv, "Validation happens before environment/credential access");
}

for (const eventType of leadEventTypes.filter(type => !boundary.publicTelemetryEventTypes.includes(type))) {
  await reject({ event_type: eventType }, "invalid_event_type");
}
for (const eventType of boundary.publicTelemetryEventTypes) {
  const response = await route.POST(request({ event_type: eventType, visitor_id: "v_test", session_id: "s_test", event_payload_json: { form_token: "synthetic-form", tracking_received: true } }));
  assert.equal(response.status, 201, `Existing allowed browser telemetry remains accepted: ${eventType}`);
  assert.equal(inserted.at(-1).event_type, eventType);
  assert.equal(inserted.at(-1).lead_id, null);
  assert.equal(inserted.at(-1).contact_id, null);
  assert.equal(inserted.at(-1).source_snapshot_id, null);
  assert.equal(inserted.at(-1).event_payload_json.event_origin, "public_browser_telemetry");
}
for (const field of ["lead_id", "contact_id", "source_snapshot_id"]) {
  await reject({ event_type: "form_view", [field]: "synthetic-other-owner" }, "untrusted_event_reference");
  await reject({ event_type: "form_view", [field]: {} }, "untrusted_event_reference");
}
for (const payload of [null, [], "text", { event_type: "form_view", visitor_id: 17 }, { event_type: "form_view", session_id: "x".repeat(121) }, { event_type: "form_view", page_url: "x".repeat(2001) }, { event_type: "form_view", referrer: "bad\nheader" }, { event_type: "form_view", event_payload_json: [] }, { event_type: "form_view", event_payload_json: { list: Array(51).fill(1) } }, { event_type: "form_view", event_payload_json: { nested: { a: { b: { c: { d: { e: { f: 1 } } } } } } } }]) {
  await reject(payload, "invalid_event_payload");
}
await reject({ event_type: "unknown_event" }, "invalid_event_type");
await reject({ event_type: "form_view", event_payload_json: { a: "字".repeat(2000), b: "字".repeat(2000) } }, "event_payload_too_large", 413);
const spoofed = boundary.validatePublicEvent({ event_type: "form_view", event_payload_json: { event_origin: "trusted_server" } });
assert.equal(spoofed.row.event_payload_json.event_origin, "public_browser_telemetry");

const malformed = await route.POST(new Request("https://public.example.test/api/public/events", { method: "POST", body: "{bad" }));
assert.equal(malformed.status, 400);
const declared = await route.POST(request({ event_type: "form_view" }, { "content-length": String(boundary.PUBLIC_EVENT_BODY_LIMIT_BYTES + 1) }));
assert.equal(declared.status, 413);
const oversizedBody = await route.POST(request({ event_type: "form_view", ignored: "x".repeat(boundary.PUBLIC_EVENT_BODY_LIMIT_BYTES) }));
assert.equal(oversizedBody.status, 413, "A missing Content-Length cannot bypass streamed request bound");
const exact = JSON.stringify({ event_type: "form_view" });
const utf8 = new TextEncoder().encode(exact);
const streamed = new Request("https://public.example.test/api/public/events", { method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(utf8.slice(0, 4)); controller.enqueue(utf8.slice(4)); controller.close(); } }), duplex: "half" });
assert.equal((await route.POST(streamed)).status, 201);

envReady = false;
assert.equal((await route.POST(request({ event_type: "form_view" }))).status, 202);
await reject({ event_type: "payment_success" }, "invalid_event_type");
envReady = true;
insertError = { code: "synthetic_storage_failure" };
assert.equal((await route.POST(request({ event_type: "form_view" }))).status, 500);

const formSource = readFileSync(new URL("../src/components/alyssa/PublicLeadForm.tsx", import.meta.url), "utf8");
assert.ok(!/logPublicEvent\(\s*["']form_submit_success["']/.test(formSource), "Registration success remains server-owned; browser must not send a rejected duplicate");
console.log("PASS: anonymous telemetry allowlist; server-owned outcomes and database references rejected before admin access; bounded JSON/streaming; legitimate browser events, storage failures and no-op behavior preserved.");
