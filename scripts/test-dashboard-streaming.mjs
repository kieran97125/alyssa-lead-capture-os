import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import ts from "typescript";

// Exercise the actual page and AppNav server components with synthetic delayed
// data reads. No live credentials, network calls, production rows or fixtures.
const root = fileURLToPath(new URL("../", import.meta.url));
const nativeRequire = createRequire(import.meta.url);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const access = { source: "shared_password", accessLevel: "master" };
class WorkspaceAccessUnavailableError extends Error {}
const el = React.createElement;
const marker = (name) => () => el("section", null, name);

function setup(currentAccess = access) {
  const reads = Object.fromEntries(["lead", "command", "source", "audit", "work", "creative"].map((key) => [key, deferred()]));
  const calls = {};
  const read = (key) => (...args) => { (calls[key] ??= []).push(args); return reads[key].promise; };
  const stubs = {
    "@/lib/marketing/commandCenter": { getCommandCenterSnapshot: read("command") },
    "@/lib/marketing/leadDashboard": { getLeadDashboardSnapshot: read("lead") },
    "@/lib/marketing/sourcePerformance": { getSourcePerformanceSnapshot: read("source") },
    "@/lib/marketing/leadSheetAuditView": { getLeadAuditNavigationSummary: read("audit") },
    "@/lib/marketing/workTasks": { getUnreadWorkNotificationCount: read("work") },
    "@/lib/creative/store": { getUnreadCreativeNotificationCount: read("creative") },
    "@/lib/security/internalAccessServer": { getCurrentInternalAccess: async () => {
      if (currentAccess instanceof Error) throw currentAccess;
      return currentAccess;
    } },
    "@/lib/security/workspaceAuth": { WorkspaceAccessUnavailableError },
    "@/app/command-center/actions": { refreshDashboardDataAction() {} },
    "@/lib/data/businessMetrics": { money: (value) => String(value) },
    "@/components/alyssa/IntentPrefetchLink": { IntentPrefetchLink: ({ children, ...props }) => el("a", props, children) },
    "@/components/command-center/DashboardRefreshButton": { DashboardRefreshButton: marker("Sync button ready") },
    "@/components/command-center/PaceBar": { PaceBar: marker("Pace"), PaceStatusBadge: marker("Pace status") },
    "@/components/command-center/BrandMark": { BrandMark: marker("Brand") },
    "@/components/command-center/LeadDashboardPanel": { LeadDashboardPanel: marker("Lead data ready") },
    "@/components/command-center/SourcePerformancePanel": { SourcePerformancePanel: marker("Source data ready") },
    "@/components/system/SystemButton": { SystemButton: ({ children, render }) => React.cloneElement(render ?? el("button"), {}, children) },
    "./AppNavNotifications": {
      AppNavNotifications: ({ children }) => el(React.Fragment, null, el("nav", null, el("a", { href: "/calendar" }, "Navigation ready")), children),
      ApplyNavigationCounts: ({ counts }) => el("span", { "data-badges": JSON.stringify(counts) }),
    },
    "next/navigation": {
      unstable_rethrow: (error) => { if (error?.digest?.startsWith("NEXT_")) throw error; },
      redirect: (location) => { throw Object.assign(new Error(location), { digest: "NEXT_REDIRECT" }); },
    },
  };
  const modules = new Map();
  function load(relativePath) {
    if (modules.has(relativePath)) return modules.get(relativePath).exports;
    const loadedModule = { exports: {} };
    modules.set(relativePath, loadedModule);
    const compiled = ts.transpileModule(readFileSync(`${root}${relativePath}`, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: relativePath,
    });
    const require = (specifier) => {
      if (specifier in stubs) return stubs[specifier];
      if (specifier.startsWith("@/")) {
        const base = `src/${specifier.slice(2)}`;
        return load([`${base}.ts`, `${base}.tsx`].find((path) => existsSync(root + path)));
      }
      return nativeRequire(specifier);
    };
    new Function("require", "module", "exports", compiled.outputText)(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return { reads, calls, load };
}

async function until(predicate, description) {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out: ${description}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const envBefore = process.env.ALYSSA_E2E_FIXTURES;
delete process.env.ALYSSA_E2E_FIXTURES;
try {
  const { reads, calls, load } = setup();
  const Page = load("src/app/dashboard/page.tsx").default;
  const tree = await Page({ searchParams: Promise.resolve({ startDate: "2026-10-05", endDate: "2026-10-01", accountId: "gos-beauty", brandId: "gos", treatment: "Offer" }) });
  assert.equal(calls.lead.length, 1);
  assert.equal(calls.source.length, 1, "Source read must start while Lead remains stalled");
  assert.deepEqual(calls.source[0][0], { startDate: "2026-10-01", endDate: "2026-10-05", accountScope: "gos-beauty", brandScope: "gos" });
  assert.equal(calls.command.length, 1, "Sync status and Operations must share their data read");
  assert.equal(calls.lead[0][0].treatment, "Offer");

  let output = "";
  const failures = [];
  const sink = new PassThrough();
  sink.on("data", (chunk) => { output += chunk; });
  const stream = renderToPipeableStream(tree, {
    onShellReady() { stream.pipe(sink); },
    onError(error) { failures.push(error); },
  });
  await until(() => output.includes("Navigation ready") && output.includes("Dashboard"), "authenticated shell before data");
  assert.ok(output.includes('data-dashboard-state="loading"'));
  assert.ok(!output.includes("Source data ready"));
  assert.ok(!output.includes("Lead data ready"));
  assert.equal(calls.audit.length, 1, "Navigation retains the audit read without a Dashboard banner");

  reads.source.resolve({ live: true, warnings: [] });
  await until(() => output.includes("Source data ready"), "Source panel while Lead is unresolved");
  assert.ok(!output.includes("Lead data ready"));
  reads.command.resolve({ schemaReady: true, dataSources: [], dataWarnings: [], brands: [], calendarItems: [], month: { today: "2026-10-05", elapsedDays: 4, daysInMonth: 31, paceRatio: 4 / 31 } });
  await until(() => output.includes("預算概覽"), "Operations while Lead is unresolved");
  reads.lead.resolve({ live: false, warnings: ["Synthetic read timeout"] });
  await until(() => output.includes('data-dashboard-state="unavailable"'), "failed Lead displays availability state");
  assert.ok(!output.includes("Lead data ready"), "A failed snapshot must not render zero KPIs as data");
  reads.audit.resolve(3);
  reads.work.reject(new Error("Synthetic notification timeout"));
  reads.creative.resolve(2);
  await until(() => output.includes('data-badges='), "notification failures remain isolated");
  assert.equal(failures.length, 0);
  assert.ok(!output.includes("項 Lead 資料異常待核對"), "Dashboard must not render the removed audit banner");
  stream.abort();

  // Supplied counts and module permissions must still control notification reads.
  const restricted = setup();
  const Nav = restricted.load("src/components/alyssa/AppNav.tsx").AppNav;
  await Nav({ access: { source: "supabase_auth", accessLevel: "admin", workspaceRole: "member", modulePermissions: { lead_audit: false, calendar: false, creative_jobs: false } } });
  assert.deepEqual(restricted.calls, {}, "Denied module notification queries must not start");
  await Nav({ access, leadAuditAlertCount: 0, workNotificationCount: 4, creativeNotificationCount: 2 });
  assert.deepEqual(restricted.calls, {}, "Provided notification counts must not trigger duplicate reads");
  const unauthenticated = setup({ source: "unauthenticated", accessLevel: null });
  await assert.rejects(unauthenticated.load("src/app/dashboard/page.tsx").default({}), /auth_unavailable/);
  assert.deepEqual(unauthenticated.calls, {}, "Unauthenticated requests must not start business reads");
  const unavailableAuth = setup(new WorkspaceAccessUnavailableError("Synthetic auth outage"));
  await assert.rejects(unavailableAuth.load("src/app/dashboard/page.tsx").default({}), /auth_unavailable/);
  assert.deepEqual(unavailableAuth.calls, {}, "Unverified auth service failures must not start business reads");
  console.log("Dashboard streaming verified: shell/navigation available with stalled reads; normalized independent Source; shared command/audit reads; independent Operations; honest Lead unavailable state; optional notification failures and permission boundaries.");
} finally {
  if (envBefore === undefined) delete process.env.ALYSSA_E2E_FIXTURES;
  else process.env.ALYSSA_E2E_FIXTURES = envBefore;
}
