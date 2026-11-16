import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
function load(filename, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../${filename}`, import.meta.url), "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(name => {
    if (name === "server-only") return {};
    if (name in mocks) return mocks[name];
    assert.ok(!name.startsWith("@/"), `Pure preview must not import a runtime data/write service: ${name}`);
    return nativeRequire(name);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const id = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const activityRow = formId => ({ form_id: formId, last_registration_at: null, last_delivery_at: null,
  pending_count: 0, blocked_count: "0", uncertain_count: 0 });
let hasEnv = true, factoryError = false, calls = [];
let responseFor = ids => ({ data: ids.map(activityRow), error: null });
const activity = load("src/lib/acquisition/formActivity.ts", {
  "@/lib/supabase/admin": {
    hasSupabaseAdminEnv: () => hasEnv,
    createSupabaseAdminClient: () => {
      if (factoryError) throw new Error("Synthetic provider construction failure");
      return { rpc: async (name, input) => {
        assert.equal(name, "get_managed_form_activity_v1");
        assert.deepEqual(Object.keys(input), ["p_form_ids"]);
        assert.ok(input.p_form_ids.length <= 200, "Activity requests must stay within the DB scope limit");
        calls.push(input.p_form_ids);
        return responseFor(input.p_form_ids);
      } };
    },
  },
});

const ids = Array.from({ length: 421 }, (_, index) => id(index + 1));
let result = await activity.getFormActivitySummaries([...ids, ids[0], "invalid", ""]);
assert.deepEqual(calls.map(chunk => chunk.length), [200, 200, 21]);
assert.deepEqual(calls.flat(), ids, "Invalid/duplicate IDs cannot expand the authorized request scope");
assert.equal(result.size, 421);
assert.equal(result.get(ids[0]).available, true, "A complete provider-confirmed zero must be available");
assert.equal(result.get(ids[0]).blockedCount, 0, "SQL bigint decimal strings are supported");

responseFor = scope => ({ data: scope.map(formId => ({ ...activityRow(formId),
  last_registration_at: "2026-11-16T10:30:00+00:00", last_delivery_at: "2026-11-16T10:31:00Z",
  pending_count: "7", blocked_count: 2, uncertain_count: "1" })), error: null });
result = await activity.getFormActivitySummaries([ids[0]]);
assert.deepEqual(result.get(ids[0]), { available: true, lastRegistrationAt: "2026-11-16T10:30:00+00:00",
  lastDeliveryAt: "2026-11-16T10:31:00Z", pendingCount: 7, blockedCount: 2, uncertainCount: 1 });

for (const [reason, respond] of [
  ["incomplete coverage", scope => ({ data: scope.slice(1).map(activityRow), error: null })],
  ["duplicate coverage", scope => ({ data: [activityRow(scope[0]), activityRow(scope[0])], error: null })],
  ["foreign coverage", scope => ({ data: [activityRow(scope[0]), activityRow(id(9999))], error: null })],
  ["provider error with plausible data", scope => ({ data: scope.map(activityRow), error: new Error("Provider failure") })],
  ["thrown provider error", () => { throw new Error("Provider failure"); }],
  ["null response", () => ({ data: null, error: null })],
  ...[null, "", -1, 1.5, "not-a-number", "9007199254740993"].map(value => [`invalid count ${String(value)}`, scope => ({ data: scope.map(formId => ({ ...activityRow(formId), pending_count: value })), error: null })]),
  ["invalid timestamp", scope => ({ data: scope.map(formId => ({ ...activityRow(formId), last_delivery_at: "not-a-date" })), error: null })],
]) {
  responseFor = respond;
  result = await activity.getFormActivitySummaries(ids.slice(0, 2));
  assert.ok([...result.values()].every(item => !item.available), `${reason} must remain unknown, never a verified zero`);
}

calls = [];
responseFor = scope => ({ data: scope[0] === ids[0] ? [] : scope.map(activityRow), error: null });
result = await activity.getFormActivitySummaries(ids);
assert.equal(result.get(ids[0]).available, false);
assert.equal(result.get(ids[200]).available, true, "One failed bounded chunk must not erase another complete chunk");
assert.equal(calls.length, 3);
const callCount = calls.length;
hasEnv = false;
result = await activity.getFormActivitySummaries([ids[0]]);
assert.equal(result.get(ids[0]).available, false);
assert.equal(calls.length, callCount);
hasEnv = true; factoryError = true;
assert.equal((await activity.getFormActivitySummaries([ids[0]])).get(ids[0]).available, false,
  "Optional activity must not prevent editing when provider construction fails");
assert.equal((await activity.getFormActivitySummaries(["invalid"])).size, 0);

const { buildPreviewFormConfig } = load("src/lib/acquisition/previewFormConfig.ts");
const form = { id: "form", brandId: "brand", publicFormToken: "preview-token", formName: "Draft campaign", status: "draft",
  allowedDomains: ["https://campaign.example.test"], defaultTreatmentId: "t1", defaultPackageId: "p1", defaultBranchId: "b1",
  packageSelectionMode: "customer_choice", conversionMode: "thank_you_redirect", successRedirectUrl: "https://campaign.example.test/thanks" };
const config = { brands: [{ id: "brand", name: "GOS Beauty", slug: "gos" }, { id: "other-brand", name: "Other brand", slug: "other" }],
  treatments: [{ id: "t1", brandId: "brand", name: "First treatment", status: "active" },
    { id: "t2", brandId: "brand", name: "Second treatment", status: "active" },
    { id: "t3", brandId: "brand", name: "Retired treatment", status: "inactive" },
    { id: "foreign-treatment", brandId: "other-brand", name: "Foreign treatment", status: "active" }],
  packages: [{ id: "p1", treatmentId: "t1", name: "First package", status: "active", promoPrice: 588 },
    { id: "p2", treatmentId: "t2", name: "Second package", status: "active", promoPrice: 888 },
    { id: "p3", treatmentId: "t1", name: "Retired package", status: "inactive" },
    { id: "p4", treatmentId: "t3", name: "Retired treatment package", status: "active" },
    { id: "foreign-package", treatmentId: "foreign-treatment", name: "Foreign package", status: "active" }],
  branches: [{ id: "b1", brandId: "brand", name: "First branch", status: "active" },
    { id: "b2", brandId: "brand", name: "Second branch", status: "active" },
    { id: "b3", brandId: "brand", name: "Retired branch", status: "inactive" },
    { id: "foreign-branch", brandId: "other-brand", name: "Foreign branch", status: "active" }],
  formPackages: ["p1", "p2", "p3", "p4", "foreign-package"].map((packageId, index) => ({ formId: "form", packageId, isActive: true, displayOrder: index === 1 ? 0 : index + 1 })),
  formBranches: ["b1", "b2", "b3", "foreign-branch"].map((branchId, index) => ({ formId: "form", branchId, isActive: true, isDefault: branchId === "b2", displayOrder: index === 1 ? 0 : index + 1 })),
};
function deepFreeze(value) {
  Object.freeze(value);
  for (const nested of Object.values(value)) if (nested && typeof nested === "object") deepFreeze(nested);
  return value;
}
deepFreeze(form); deepFreeze(config);
const before = JSON.stringify({ config, form });
const preview = buildPreviewFormConfig(config, form);
assert.equal(preview.ok, true);
assert.equal(preview.brand.id, "brand");
assert.deepEqual(preview.packages.map(item => item.id), ["p2", "p1"], "Customer choices preserve configured membership order across same-brand treatments");
assert.deepEqual(preview.treatments.map(item => item.id), ["t1", "t2"]);
assert.deepEqual(preview.branches.map(item => [item.id, item.is_default]), [["b2", true], ["b1", false]], "Branch membership default and order match live configuration");
assert.equal(preview.form.public_form_token, form.publicFormToken);
assert.equal(preview.form.package_selection_mode, "customer_choice");
assert.equal(preview.form.conversion_mode, "thank_you_redirect");
assert.equal(preview.form.success_redirect_url, form.successRedirectUrl);
assert.equal(JSON.stringify({ config, form }), before, "An inert preview must never mutate authorized source configuration");

assert.deepEqual(buildPreviewFormConfig(config, { ...form, packageSelectionMode: "fixed" }).packages.map(item => item.id), ["p1"]);
assert.deepEqual(buildPreviewFormConfig({ ...config, formPackages: [], formBranches: [] }, form).branches.map(item => [item.id, item.is_default]), [["b1", true]]);
assert.deepEqual(buildPreviewFormConfig({ ...config, formBranches: [] }, { ...form, defaultBranchId: null }).branches.map(item => [item.id, item.is_default]), [["b1", true], ["b2", false]]);
const inactiveLinks = { ...config, formPackages: config.formPackages.map(item => ({ ...item, isActive: false })), formBranches: config.formBranches.map(item => ({ ...item, isActive: false })) };
assert.deepEqual(buildPreviewFormConfig(inactiveLinks, form).packages.map(item => item.id), ["p1"], "Inactive memberships preserve valid-default fallback");
for (const override of [{ brandId: "missing" }, { defaultTreatmentId: "foreign-treatment" }, { defaultTreatmentId: "t3" },
  { packageSelectionMode: "fixed", defaultPackageId: "foreign-package" }, { packageSelectionMode: "fixed", defaultPackageId: "p3" }]) {
  assert.throws(() => buildPreviewFormConfig(config, { ...form, ...override }), /preview_configuration_unavailable/);
}
assert.throws(() => buildPreviewFormConfig({ ...config, formBranches: [] }, { ...form, defaultBranchId: "foreign-branch" }), /preview_configuration_unavailable/);
console.log("PASS: bounded authorized activity requests distinguish complete zero from provider/incomplete/malformed data; inert previews preserve active brand-scoped offer membership/order/defaults without reads or writes.");
