import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const requirePackage = createRequire(import.meta.url);

const cache = new Map();
function load(relative, mocks = {}) {
  if (cache.has(relative) && Object.keys(mocks).length === 0) return cache.get(relative);
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", source)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "react/jsx-runtime") return requirePackage(name);
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    throw new Error(`Unexpected runtime import: ${name}`);
  }, module, module.exports);
  if (Object.keys(mocks).length === 0) cache.set(relative, module.exports);
  return module.exports;
}
const queue = load("src/lib/crm/operationQueues.ts");
const channel = load("src/lib/crm/channelReadiness.ts");
const navigation = load("src/lib/crm/navigation.ts");
const now = Date.parse("2026-11-15T16:30:00Z"); // 16 November, 00:30 HKT.
const row = (id, status, extras = {}) => ({ id, status, nextFollowUpAt: null, confirmedBookingDate: "2026-11-16", confirmedBookingTime: "18:00", ...extras });
const cases = [row("booked", "booked"), row("no-show", "no_show"), row("showed", "showed"), row("cancelled", "cancelled"), row("new", "new")];
assert.deepEqual(queue.filterCrmBookingQueue(cases, "no_show", now).map(x => x.id), ["no-show"]);
assert.deepEqual(queue.filterCrmBookingQueue(cases, "booked", now).map(x => x.id), ["booked"]);
assert.deepEqual(queue.filterCrmBookingQueue(cases, "", now).map(x => x.id), ["booked", "no-show", "showed", "cancelled"]);
assert.deepEqual(queue.filterCrmBookingQueue(cases, "pending_show_outcome", now), []);
assert.deepEqual(queue.filterCrmBookingQueue([row("due", "booked", { confirmedBookingDate: "2026-11-15", confirmedBookingTime: "23:00" }), cases[1]], "pending_show_outcome", now).map(x => x.id), ["due"]);
for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
  process.env.TZ = zone;
  assert.equal(queue.crmDayKey(Date.parse("2026-11-15T15:59:59Z")), "2026-11-15", zone);
  assert.equal(queue.crmDayKey(Date.parse("2026-11-15T16:00:00Z")), "2026-11-16", zone);
  assert.equal(queue.isCrmTodayDateOnly("2026-11-16", now), true, zone);
  assert.equal(queue.isCrmToday("2026-11-15T16:05:00Z", now), true, zone);
  assert.equal(queue.isCrmToday("2026-11-15T15:59:00Z", now), false, zone);
  assert.equal(queue.isCrmTodayBooking(cases[0], now), true, zone);
  assert.equal(queue.isCrmTodayBooking(cases[1], now), false, zone);
  assert.equal(queue.isCrmOverdueFollowUp(row("old", "contacting", { nextFollowUpAt: "2026-11-15T15:59:00Z" }), now), true, zone);
  assert.equal(queue.isCrmOverdueFollowUp(row("today", "contacting", { nextFollowUpAt: "2026-11-15T16:05:00Z" }), now), false, zone);
}
assert.equal(queue.isCrmToday("invalid", now), false);
assert.equal(queue.isCrmToday(null, now), false);
assert.equal(queue.parseCrmBookingDateTime("2026-02-30", "18:00"), null);
assert.equal(queue.parseCrmBookingDateTime("2026-11-16", "25:00"), null);
assert.equal(queue.parseCrmBookingDateTime("2026-11-16", null).toISOString(), "2026-11-16T15:59:59.000Z");

const view = (status, extras = {}) => ({ ok: true, tableReady: true, encryptionConfigured: true, connection: status ? { status } : null, ...extras });
for (const status of [null, "not_configured", "saved", "webhook_verified", "error", "future_unknown"]) assert.equal(channel.resolveCrmChannelReadiness(view(status)).ready, false, String(status));
assert.equal(channel.resolveCrmChannelReadiness(view("saved")).label, "待測試");
assert.equal(channel.resolveCrmChannelReadiness(view("webhook_verified")).label, "Webhook 已驗證");
assert.equal(channel.resolveCrmChannelReadiness(view("test_succeeded")).ready, true);
assert.equal(channel.resolveCrmChannelReadiness(view("test_succeeded", { ok: false })).ready, false);
assert.equal(channel.resolveCrmChannelReadiness(view("test_succeeded", { encryptionConfigured: false })).ready, false);
assert.equal(channel.resolveCrmChannelReadiness(view("error")).tone, "error");
const brands = [{ id: "a", slug: "brand-a", name: "Brand A" }, { id: "b", slug: "brand-b", name: "Brand B" }];
assert.equal(channel.resolveSingleCrmBrand(brands, "brand-b").id, "b");
assert.equal(channel.resolveSingleCrmBrand(brands, "a").name, "Brand A");
assert.equal(channel.resolveSingleCrmBrand(brands, "unknown"), null);
assert.equal(channel.resolveSingleCrmBrand(brands, ""), null);
assert.equal(channel.resolveSingleCrmBrand([brands[0]], "alyssa-all"), null);
assert.equal(channel.crmWhatsAppSettingsHref(brands[1]), "/crm/settings/whatsapp?brand=brand-b");

assert.equal(navigation.withCrmBrandScope("/crm?tab=bookings", "brand-b"), "/crm?tab=bookings&brand=brand-b");
assert.equal(navigation.withCrmBrandScope("/crm/settings", "brand-b"), "/crm/settings?brand=brand-b");
assert.equal(navigation.withCrmBrandScope("/crm/settings/whatsapp", "brand-b"), "/crm/settings/whatsapp?brand=brand-b");
assert.equal(navigation.withCrmBrandScope("/crm/settings", "alyssa-all"), "/crm/settings");
assert.equal(navigation.withCrmBrandScope("/crm?tab=reports", "alyssa-all"), "/crm?tab=reports&brand=alyssa-all");
assert.equal(navigation.withCrmBrandScope("/dashboard", "brand-b"), "/dashboard");
assert.equal(navigation.withCrmBrandScope("https://example.invalid/crm", "brand-b"), "https://example.invalid/crm");

let allowed = true;
let writes = [];
const actions = load("src/app/crm/settings/whatsapp/actions.ts", {
  "next/cache": { revalidatePath: () => {} },
  "next/navigation": { redirect: path => { throw Object.assign(new Error("redirect"), { path }); } },
  "@/lib/security/internalAccessServer": {
    requireModuleAccess: async () => ({ allowed, access: {} }),
    canAccessInternalBrand: (_access, brandId) => brandId === "b",
  },
  "@/lib/crm/whatsapp": {
    WHATSAPP_PROVIDER_META: "meta_whatsapp_cloud_api",
    saveWhatsAppConnection: async input => { writes.push(input); return { ok: true, message: "saved" }; },
    sendWhatsAppTextMessage: async input => { writes.push(input); return { ok: true, message: "tested" }; },
  },
});
for (const action of [actions.saveWhatsAppConnectionAction, actions.testWhatsAppSendAction]) {
  for (const brandId of ["a", "b"]) {
    const form = new FormData(); form.set("brandId", brandId);
    writes = [];
    try { await action(form); assert.fail("Expected redirect"); } catch (error) {
      assert.ok(error.path);
      const result = new URL(error.path, "https://example.invalid");
      assert.equal(result.searchParams.get("brand"), brandId, "Selected brand survives mutation redirect");
      assert.equal(writes.length, brandId === "b" ? 1 : 0, "Unauthorized brands never write");
      if (writes.length) assert.equal(writes[0].brandId, brandId);
    }
  }
  allowed = false; writes = [];
  const form = new FormData(); form.set("brandId", "b");
  await assert.rejects(action(form), error => Boolean(error.path?.includes("settings_error")));
  assert.equal(writes.length, 0, "Module denial never writes");
  allowed = true;
}
// Exercise the actual route orchestration: incomplete reads must not render zero totals.
for (const failure of ["leads", "cases", "bookings"]) {
  let caseReads = 0;
  const page = load("src/app/crm/page.tsx", {
    "@/components/crm/CrmInboxTable": { crmInboxPresets: [{ key: "cs_booking" }], CrmInboxTable: "CrmInboxTable" },
    "@/components/crm/CrmShell": { CrmShell: "CrmShell" },
    "@/components/command-center/DashboardRegionState": { DashboardRegionState: "DashboardRegionState" },
    "@/components/alyssa/SubmitButton": { SubmitButton: "SubmitButton" },
    "@/lib/crm/settingsLoader": { getCrmSettings: async () => ({}) },
    "@/lib/crm/whatsapp": { getWhatsAppConnectionByBrandSlug: async () => assert.fail("Failed data never attempts channel rendering") },
    "@/lib/attribution/display": {},
    "@/lib/crm/leadOps": { toCrmLeadCase: () => assert.fail("Incomplete data never computes operational totals") },
    "@/lib/crm/store": {
      getCrmRuntimeStatus: async () => ({ writeFlagEnabled: true, actionsEnabled: true, tablesAvailable: true }),
      getCrmCasesBySourceLeadIds: async (_ids, options) => {
        caseReads++; assert.equal(options.completeness, "complete");
        if (failure === "cases") throw new Error("incomplete");
        return new Map([["lead-a", { id: "case-a" }]]);
      },
      getCrmBookingsByCaseIds: async (_ids, options) => {
        assert.equal(options.completeness, "complete");
        if (failure === "bookings") throw new Error("incomplete");
        return new Map();
      },
    },
    "@/lib/data/businessMetrics": {
      parseRange: () => "all",
      getLeadRows: async (_range, _limit, options) => {
        assert.equal(options.completeness, "complete");
        return { leads: failure === "leads" ? [] : [{ id: "lead-a" }], error: failure === "leads" ? "unavailable" : null };
      },
    },
    "@/lib/data/configuration": { getConfiguredBrands: async () => brands },
  });
  const result = await page.default({ searchParams: Promise.resolve({ tab: "bookings", queue: "no_show", brand: "brand-b" }) });
  assert.equal(result.type.name, "CrmReadUnavailable", failure);
  assert.equal(result.props.brandScope, "b", "Read failure preserves validated brand scope");
  assert.ok(result.props.retryHref.includes("queue=no_show"));
  if (failure === "leads") assert.equal(caseReads, 0, "Failed lead read stops relation fanout");
}
let connectionBrands = [];
const settingsPage = load("src/app/crm/settings/page.tsx", {
  "next/link": { default: "Link" },
  "next/navigation": { notFound: () => { throw new Error("not-found"); } },
  "@/components/crm/CrmShell": { CrmShell: "CrmShell" },
  "@/components/system/SystemButton": { SystemButton: "SystemButton" },
  "@/lib/data/configuration": { getConfiguredBrands: async () => brands },
  "@/lib/crm/whatsapp": { getWhatsAppConnectionByBrandSlug: async slug => { connectionBrands.push(slug); return view("saved"); } },
});
const settings = await settingsPage.default({ searchParams: Promise.resolve({ brand: "brand-b" }) });
assert.deepEqual(connectionBrands, ["brand-b"], "Settings reads exactly the selected brand, never another brand fallback");
assert.equal(settings.props.brandScope, "brand-b");
const texts = [];
function visit(value) {
  if (typeof value === "string") texts.push(value);
  else if (Array.isArray(value)) value.forEach(visit);
  else if (value?.props) visit(value.props.children);
}
visit(settings);
assert.ok(texts.includes("待測試"), "A saved record renders pending test, not connected");
assert.equal(texts.includes("已連接"), false);
await assert.rejects(settingsPage.default({ searchParams: Promise.resolve({ brand: "unknown" }) }), /not-found/);
assert.deepEqual(connectionBrands, ["brand-b"], "Invalid brand lookup never queries another connection");
console.log("PASS: CRM outcomes/HKT/readiness/brand authorization, selected-brand settings, and route-level fail-closed reads");
