import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}
const schema = load("src/lib/acquisition/managedFormSchema.ts");
assert.equal(schema.normalizePlacementUrl("https://user:secret@example.test/offer"), null);
assert.equal(schema.normalizePlacementUrl("javascript:alert(1)"), null);
const ids = { brand: "a0000000-0000-4000-8000-000000000001", treatment: "b0000000-0000-4000-8000-000000000001", package: "c0000000-0000-4000-8000-000000000001", branch: "d0000000-0000-4000-8000-000000000001", form: "e0000000-0000-4000-8000-000000000001", request: "f0000000-0000-4000-8000-000000000001" };
const form = { id: ids.form, publicFormToken: "installed-stable-token", formName: "Existing", brandId: ids.brand, status: "archived", revision: 7, placementKind: "wix", placementUrl: "https://example.test/offer", successRedirectUrl: null };
const config = { brands: [{ id: ids.brand, slug: "synthetic" }], treatments: [{ id: ids.treatment, brandId: ids.brand, status: "active" }], packages: [{ id: ids.package, treatmentId: ids.treatment, status: "active" }], branches: [{ id: ids.branch, brandId: ids.brand, status: "active" }], forms: [form] };
let readError = false; let databaseError = null; const calls = [];
const management = load("src/lib/data/formManagement.ts", {
  "@/lib/data/alyssaConfig": { alyssaDefaultForm: {} },
  "@/lib/data/configuration": {
    getConfigurationData: async options => { assert.equal(options.strict, true); if (readError) throw Error("source down"); return config; },
    getBrand: (data, id) => data.brands.find(row => row.id === id), getTreatment: (data, id) => data.treatments.find(row => row.id === id), getPackage: (data, id) => data.packages.find(row => row.id === id), getBranch: (data, id) => data.branches.find(row => row.id === id),
  },
  "@/lib/data/brandDefaults": { getBrandLaunchDefaults: () => null },
  "@/lib/data/appUrl": { getPublicBaseUrl: () => "https://public.example.test" },
  "@/lib/acquisition/managedFormSchema": schema,
  "@/lib/supabase/admin": { hasSupabaseAdminEnv: () => true, createSupabaseAdminClient: () => ({ rpc: async (name, args) => {
    calls.push({ name, args });
    if (databaseError) return { data: null, error: databaseError };
    return { data: { replayed: false, form: { id: ids.form, public_form_token: "installed-stable-token", brand_id: ids.brand, form_name: args.p_payload.form_name ?? "Existing", status: "archived", revision: 8, allowed_domains: ["https://example.test"], default_treatment_id: ids.treatment, default_package_id: ids.package, default_branch_id: ids.branch, package_selection_mode: "fixed", placement_kind: "wix", placement_url: "https://example.test/offer" } }, error: null };
  } }) },
});
const input = { formName: "Updated", brandId: ids.brand, defaultTreatmentId: ids.treatment, defaultPackageId: ids.package, defaultBranchId: ids.branch, packageSelectionMode: "fixed", packageIds: [], branchIds: [ids.branch], allowedDomains: [], placementKind: "wix", placementUrl: "https://example.test/offer", expectedRevision: 7, requestId: ids.request };
const prepared = await management.prepareManagedFormPayload(input);
assert.equal(prepared.ok, true);
assert.deepEqual(prepared.payload.allowed_domains, ["https://example.test"]);
assert.deepEqual(prepared.payload.package_ids, [ids.package]);
const injected = await management.prepareManagedFormPayload({ ...input,
  tokenBase: "attacker-token", token_base: "attacker-token", conversionMode: "thank_you_redirect", conversion_mode: "thank_you_redirect",
  successRedirectUrl: "https://attacker.example.test", success_redirect_url: "https://attacker.example.test" });
assert.equal(injected.ok, true);
assert.equal(injected.payload.conversion_mode, "form_submit_pixel", "Conversion mode is derived by server, never accepted as hidden input");
assert.equal(injected.payload.success_redirect_url, null, "Injected success destination cannot replace server-derived settings");
assert.equal(injected.payload.token_base, prepared.payload.token_base, "Injected token base cannot alter stable request identity");
assert.equal((await management.prepareManagedFormPayload({ ...input, brandId: "unavailable-brand" })).ok, false, "Out-of-scope brand cannot reach writer");
config.branches[0].status = "archived";
assert.equal((await management.prepareManagedFormPayload(input)).ok, false, "Inactive branches cannot be offered");
config.branches[0].status = "active";
config.packages[0].treatmentId = "other-treatment";
assert.equal((await management.prepareManagedFormPayload(input)).ok, false, "Cross-treatment package rejected");
config.packages[0].treatmentId = ids.treatment;
const otherTreatment = "b0000000-0000-4000-8000-000000000002";
const otherPackage = "c0000000-0000-4000-8000-000000000002";
config.treatments.push({ id: otherTreatment, brandId: ids.brand, status: "active" });
config.packages.push({ id: otherPackage, treatmentId: otherTreatment, status: "active" });
const legacyChoices = await management.prepareManagedFormPayload({ ...input, packageSelectionMode: "customer_choice", packageIds: [otherPackage, ids.package] });
assert.equal(legacyChoices.ok, true, "Legacy same-brand customer choices may span active treatments");
assert.deepEqual(legacyChoices.payload.package_ids, [otherPackage, ids.package], "Configured customer-choice ordering is retained");
config.treatments.at(-1).status = "archived";
assert.equal((await management.prepareManagedFormPayload({ ...input, packageSelectionMode: "customer_choice", packageIds: [otherPackage] })).ok, false, "Inactive related treatment cannot be offered");
config.treatments.at(-1).status = "active";
assert.equal((await management.updateForm(ids.form, { ...input, expectedRevision: undefined })).ok, false);
assert.equal(calls.length, 0, "Missing expected revision never fetches latest and writes");
const updated = await management.updateForm(ids.form, input);
assert.equal(updated.ok, true);
assert.equal(updated.form.status, "archived");
assert.equal(calls[0].args.p_expected_revision, 7);
assert.ok(!Object.hasOwn(calls[0].args.p_payload, "status"), "Saving settings cannot reactivate archived form");
assert.ok(!Object.hasOwn(calls[0].args.p_payload, "public_form_token"), "Renaming keeps installed identity");
assert.equal((await management.createForm(input)).ok, true);
assert.equal((await management.createForm(input)).ok, true);
assert.equal(calls.at(-1).args.p_request_id, ids.request);
assert.deepEqual(calls.at(-1).args, calls.at(-2).args, "Stable creation request is forwarded unchanged on retry");
databaseError = { code: "40001", message: "managed_form_revision_conflict" };
assert.match((await management.updateForm(ids.form, input)).message, /重新載入/);
databaseError = null;
readError = true;
const count = calls.length;
assert.equal((await management.createForm(input)).ok, false);
assert.equal(calls.length, count, "Configuration failure cannot write seed or fallback settings");

// Exercise actual configuration module fail-closed behavior and scope handling.
let envReady = true; let relationFailure = false; let partial = false;
const rows = { brands: [{ id: ids.brand, name: "Synthetic", slug: "synthetic" }], treatments: [], packages: [], branches: [], forms: [], form_branches: [], form_packages: [] };
const configuration = load("src/lib/data/configuration.ts", {
  "@/lib/acquisition/offerDisplay": load("src/lib/acquisition/offerDisplay.ts"),
  "@/lib/data/alyssaConfig": { alyssaBrand: { id: "fixture-brand" }, alyssaDefaultForm: { id: "fixture-form" }, alyssaBranches: [], alyssaPackages: [], alyssaTreatments: [] },
  "@/lib/data/landingPages": { alyssaLandingPages: [] }, "@/lib/data/systemBrands": { fallbackSystemBrands: [] },
  "@/lib/security/internalAccessServer": { getCurrentInternalAccess: async () => ({ source: "supabase_auth", accessLevel: "staff", brandIds: [ids.brand] }) },
  "@/lib/supabase/admin": { hasSupabaseAdminEnv: () => envReady, createSupabaseAdminClient: () => ({ from: table => {
    const query = { select() { return query; }, order() { return query; }, then(resolve, reject) { return Promise.resolve({ data: rows[table], count: rows[table].length + (partial && table === "forms" ? 1 : 0), error: relationFailure && table === "form_packages" ? { message: "unavailable" } : null }).then(resolve, reject); } }; return query;
  } }) },
});
const oldFixture = process.env.ALYSSA_E2E_FIXTURES;
try {
  delete process.env.ALYSSA_E2E_FIXTURES;
  assert.equal((await configuration.getAcquisitionConfigurationData()).available, true);
  relationFailure = true;
  assert.equal((await configuration.getAcquisitionConfigurationData()).available, false, "Missing membership read never falls back to default links");
  relationFailure = false; partial = true;
  assert.equal((await configuration.getAcquisitionConfigurationData()).available, false, "Truncated complete catalog never reports success");
  partial = false; envReady = false;
  await assert.rejects(configuration.getConfigurationData({ strict: true }), configuration.ConfigurationReadError);
  process.env.ALYSSA_E2E_FIXTURES = "1";
  const fixture = await configuration.getConfigurationData({ unscoped: true, strict: true });
  assert.equal(fixture.forms[0].revision, 1, "Only explicit fixture mode can read local settings");
} finally { if (oldFixture === undefined) delete process.env.ALYSSA_E2E_FIXTURES; else process.env.ALYSSA_E2E_FIXTURES = oldFixture; }
console.log("Managed form validation, strict source reads, scope, revision forwarding and stable creation requests passed.");
