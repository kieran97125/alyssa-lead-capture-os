import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(filename, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}

let configured = true;
let failure = null;
let adminCalls = 0;
const reads = [];
const counts = { pending: 5, retry: 4, processing: 2, delivered: 12001, blocked: 3, uncertain: 8, skipped: 7 };
const checkedAt = "2026-11-16T03:00:00.123456Z";
let responseData = { counts, checked_at: checkedAt };
const summaryModule = load("src/lib/capture/deliverySummary.ts", {
  "server-only": {},
  "@/lib/supabase/admin": {
    hasSupabaseAdminEnv: () => configured,
    createSupabaseAdminClient: () => {
      adminCalls++;
      return { rpc: async (...args) => {
        reads.push(args);
        return { data: responseData, error: failure };
      } };
    },
  },
});

const normal = await summaryModule.getLeadDeliverySummary();
assert.equal(normal.available, true);
assert.deepEqual(normal.counts, counts);
assert.equal(normal.total, 12030, "Summary includes complete aggregate counts well beyond UI row limits");
assert.deepEqual(reads, [["get_public_lead_delivery_summary"]], "All statuses come from one aggregate SQL snapshot without row payloads");
assert.equal(normal.checkedAt, checkedAt, "Keep the database snapshot timestamp rather than replacing it with browser/server time");

failure = { message: "private source https://private.example.test/payload phone-data", code: "synthetic" };
const unavailable = await summaryModule.getLeadDeliverySummary();
assert.deepEqual(unavailable, { available: false, reason: "read_failed" });
assert.ok(!JSON.stringify(unavailable).includes("private"));
failure = null;
for (const data of [null, { counts: { ...counts, pending: null }, checked_at: checkedAt }, { counts: { ...counts, pending: -1 }, checked_at: checkedAt }, { counts, checked_at: "invalid" }, { counts: { ...counts, unexpected: 1 }, checked_at: checkedAt }]) {
  responseData = data;
  assert.equal((await summaryModule.getLeadDeliverySummary()).available, false, "Missing/invalid snapshot is unavailable, never invented zero counts");
}
responseData = { counts, checked_at: checkedAt };
configured = false;
const beforeAdmin = adminCalls;
assert.deepEqual(await summaryModule.getLeadDeliverySummary(), { available: false, reason: "not_configured" });
assert.equal(adminCalls, beforeAdmin);

const { LeadDeliveryStatusPanel, parseLeadDeliveryRecoveryFeedback } = load("src/components/capture/LeadDeliveryStatusPanel.tsx", {
  "@/components/system/SystemButton": { SystemButton: ({ render, children, disabled, type }) => render ? React.cloneElement(render, {}, children) : React.createElement("button", { disabled, type }, children) },
  "@/components/alyssa/SubmitButton": { SubmitButton: ({ children }) => React.createElement("button", { type: "submit" }, children) },
});
const render = (summary, props = {}) => renderToStaticMarkup(React.createElement(LeadDeliveryStatusPanel, { summary, ...props }));
const normalHtml = render({ ...normal, checkedAt: "2026-11-15T16:30:00.000Z" });
assert.ok(normalHtml.includes("12,030"));
assert.match(normalHtml, /data-delivery-group="working"[\s\S]*?<dd[^>]*>6<\/dd>/);
assert.ok(normalHtml.includes("香港時間") && normalHtml.includes("16/11/2026"), "Audit timestamps explicitly use HKT across UTC midnight");
assert.ok(normalHtml.includes('href="/system-audit"'));
assert.ok(!normalHtml.includes("重新檢查") && !normalHtml.includes("<form"), "Read-only refresh cannot masquerade as a delivery mutation");
assert.ok(normalHtml.includes("待核對記錄會先確認同步結果，避免重複加入。"));
for (const state of [unavailable, { available: false, reason: "not_configured" }]) {
  const html = render(state);
  assert.ok(!html.includes('data-testid="lead-delivery-total"'));
  assert.ok(!html.includes("<dd"), "Unavailable status must not render false zero counters");
  assert.ok(html.includes('role="status"'));
}
const empty = render({ available: true, counts: Object.fromEntries(Object.keys(counts).map(key => [key, 0])), total: 0, checkedAt: normal.checkedAt });
assert.ok(empty.includes("暫時未有登記同步記錄。"));
assert.ok(empty.includes('data-testid="lead-delivery-total">0<'));
assert.ok(!empty.includes("未能讀取"));
const enabled = render(normal, { recoveryAccess: { allowed: true }, recheckAction: async () => undefined });
assert.ok(enabled.includes("<form") && enabled.includes("重新檢查同步"));
const password = render(normal, { recoveryAccess: { allowed: false, reason: "member_required" } });
assert.ok(password.includes("disabled") && password.includes("管理員電郵登入"));
assert.ok(!password.includes("<form"));
const feedback = render(normal, { feedback: { status: "scheduled", count: 3 } });
assert.ok(feedback.includes("已安排重新檢查 3 筆同步記錄。"));
assert.deepEqual(parseLeadDeliveryRecoveryFeedback({ delivery_recheck: "scheduled", delivery_count: "10", message: "private untrusted text" }), { status: "scheduled", count: 10 });
for (const query of [{ delivery_recheck: "scheduled", delivery_count: "11" }, { delivery_recheck: "scheduled", delivery_count: "3private" }, { delivery_recheck: ["scheduled"], delivery_count: "3" }, { delivery_recheck: "https://untrusted.example.test" }]) assert.equal(parseLeadDeliveryRecoveryFeedback(query), undefined);

const boundary = load("src/lib/security/routeBoundary.ts");
assert.equal(boundary.requiresMasterAccess("/system-audit"), true, "Delivery aggregates remain on the existing master-only audit surface");
console.log("PASS: single complete aggregate snapshot without customer rows; read failure and true zero remain distinct; PII-free summary; grouped retry/processing, HKT, member-aware recovery and safe feedback.");
