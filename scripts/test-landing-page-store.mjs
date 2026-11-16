import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(filename, mocks = {}) {
  const loaded = { exports: {} };
  const source = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", code)(name => mocks[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}

const seed = load("src/lib/data/alyssaConfig.ts");
const pageDefinitions = load("src/lib/data/landingPages.ts", { "@/lib/data/alyssaConfig": seed });
const ids = {
  page: "a6000000-0000-4000-8000-000000000001", otherPage: "a6000000-0000-4000-8000-000000000002",
  brand: "a1000000-0000-4000-8000-000000000001", otherBrand: "b1000000-0000-4000-8000-000000000001",
  form: "a5000000-0000-4000-8000-000000000001", draftForm: "a5000000-0000-4000-8000-000000000002",
  published: "a7000000-0000-4000-8000-000000000002", draft: "a7000000-0000-4000-8000-000000000003",
};
const metadata = {
  slug: "synthetic-published-page", title: "Approved published title", brand_id: ids.brand,
  treatment_id: "a2000000-0000-4000-8000-000000000001", package_id: "a3000000-0000-4000-8000-000000000001",
  branch_id: "a4000000-0000-4000-8000-000000000001", form_id: ids.form,
  template_key: "premium_offer_landing_page", mode: "landing_page", metadata_source: "version_snapshot",
};
const row = {
  id: ids.page, ...metadata, title: "Legacy row title", status: "published",
  content_json: { heroTitle: "Stale row content" }, image_assets_json: {},
  published_version_id: ids.published, published_at: "2026-11-15T00:00:00.000Z",
  created_at: "2026-11-14T00:00:00.000Z", updated_at: "2026-11-16T00:00:00.000Z", revision: 4,
};
const published = {
  id: ids.published, page_id: ids.page, version_number: 2, status: "published", page_revision: 3,
  content_json: { heroTitle: "Approved published headline", ctaText: "Approved CTA" },
  image_assets_json: { heroImageUrl: "/approved-synthetic-image.png" }, metadata_json: metadata,
  created_at: "2026-11-15T00:00:00.000Z",
};
const draft = {
  id: ids.draft, page_id: ids.page, version_number: 3, status: "draft", page_revision: 4,
  content_json: { heroTitle: "New saved draft headline", ctaText: "Draft CTA" },
  image_assets_json: { heroImageUrl: "/draft-synthetic-image.png" },
  metadata_json: { ...metadata, slug: "synthetic-draft-url", title: "New draft title", form_id: ids.draftForm },
  created_at: "2026-11-16T00:00:00.000Z",
};
let state;
function reset() {
  state = { envReady: true, access: { source: "supabase_auth", accessLevel: "staff", brandIds: [ids.brand] },
    pages: [structuredClone(row)], versions: [structuredClone(published), structuredClone(draft)],
    errors: new Set(), truncated: false, moduleAllowed: true, calls: [] };
}
reset();

// This adapter supplies database responses, while the production store owns all
// filtering, status decisions, version choice, scoping and DTO construction.
function from(table) {
  const filters = [];
  const ordering = [];
  let limit;
  let single = false;
  let counted = false;
  const query = {
    select(_columns, options) { counted = options?.count === "exact"; return query; },
    eq(key, value) { filters.push(item => item[key] === value); return query; },
    in(key, values) { filters.push(item => values.includes(item[key])); return query; },
    order(key, options) { ordering.push({ key, ascending: options?.ascending !== false }); return query; },
    limit(value) { limit = value; return query; },
    maybeSingle() { single = true; return query; },
    then(resolve, reject) {
      state.calls.push(table);
      if (!["landing_pages", "landing_page_versions"].includes(table)) throw Error(`Unexpected table ${table}`);
      let data = (table === "landing_pages" ? state.pages : state.versions).filter(item => filters.every(filter => filter(item)));
      for (const { key, ascending } of ordering.toReversed()) {
        data = data.toSorted((a, b) => a[key] === b[key] ? 0 : (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1));
      }
      const count = counted ? data.length + (state.truncated ? 1 : 0) : null;
      if (limit !== undefined) data = data.slice(0, limit);
      const error = state.errors.has(table) ? { code: "synthetic_unavailable", message: "Synthetic source failure" } : null;
      return Promise.resolve({ data: error ? null : single ? data[0] ?? null : data, count, error }).then(resolve, reject);
    },
  };
  return query;
}
const store = load("src/lib/data/landingPageStore.ts", {
  "@/lib/data/alyssaConfig": seed,
  "@/lib/data/landingPages": pageDefinitions,
  "@/lib/data/formManagement": { prepareManagedFormPayload: () => { throw Error("Read test must never prepare a write"); } },
  "@/lib/supabase/admin": { hasSupabaseAdminEnv: () => state.envReady,
    createSupabaseAdminClient: () => ({ from, rpc: () => { throw Error("Read test must never write"); } }) },
  "@/lib/security/internalAccessServer": { getCurrentInternalAccess: async () => state.access,
    requireModuleAccess: async module => { assert.equal(module, "landing_pages"); return { allowed: state.moduleAllowed }; },
    canAccessInternalBrand: (access, brandId) => access.accessLevel === "master" || access.brandIds.includes(brandId) },
});

const priorFixture = process.env.ALYSSA_E2E_FIXTURES;
const priorNodeEnv = process.env.NODE_ENV;
const priorWarn = console.warn;
try {
  delete process.env.ALYSSA_E2E_FIXTURES;
  console.warn = () => {}; // Expected synthetic database failures contain no useful diagnostics here.

  for (const environment of ["production", "development"]) {
    process.env.NODE_ENV = environment;
    reset(); state.envReady = false;
    const list = await store.getLandingPageList();
    assert.equal(list.available, false, "Unconfigured sources are unavailable in every runtime mode");
    assert.deepEqual(list.pages, [], "Unconfigured source never substitutes seed pages");
    assert.equal(list.canPersist, false);
    await assert.rejects(store.getPublishedLandingPageBySlug(metadata.slug), store.LandingPageReadError);
    await assert.rejects(store.getLandingPageEditorState(ids.page), store.LandingPageReadError);
  }

  reset(); state.pages = []; state.versions = [];
  const empty = await store.getLandingPageList();
  assert.equal(empty.available, true, "A complete empty read remains distinguishable from failure");
  assert.equal(empty.canPersist, true);
  assert.deepEqual(empty.pages, []);
  assert.equal(await store.getPublishedLandingPageBySlug(metadata.slug), null);
  assert.equal(await store.getLandingPageEditorState(ids.page), null);

  reset();
  const live = await store.getPublishedLandingPageBySlug(metadata.slug);
  assert.equal(live.heroTitle, "Approved published headline");
  assert.equal(live.heroImageUrl, "/approved-synthetic-image.png");
  assert.equal(live.title, "Approved published title");
  assert.equal(live.formId, ids.form);
  assert.equal(live.slug, metadata.slug);
  const editor = await store.getLandingPageEditorState(ids.page);
  assert.equal(editor.page.heroTitle, "New saved draft headline");
  assert.equal(editor.page.heroImageUrl, "/draft-synthetic-image.png");
  assert.equal(editor.page.slug, "synthetic-draft-url");
  assert.equal(editor.page.formId, ids.draftForm);
  assert.equal(editor.publishedSlug, metadata.slug);
  assert.equal(editor.revision, 4);
  const list = await store.getLandingPageList();
  assert.equal(list.available, true);
  assert.equal(list.pages[0].heroTitle, "New saved draft headline");
  assert.equal((await store.getPublishedLandingPageBySlug(metadata.slug)).heroTitle, "Approved published headline",
    "Opening the editor or list cannot expose a saved draft on the public route");
  assert.equal(await store.getPublishedLandingPageBySlug("synthetic-draft-url"), null, "An unpublished draft URL is not public");

  for (const badPointer of [null, "a7000000-0000-4000-8000-000000000099", ids.draft]) {
    reset(); state.pages[0].published_version_id = badPointer;
    assert.equal(await store.getPublishedLandingPageBySlug(metadata.slug), null,
      "Missing or nonpublished approval cannot fall back to current row/latest draft/seed");
  }
  reset(); state.versions[0].page_id = ids.otherPage;
  assert.equal(await store.getPublishedLandingPageBySlug(metadata.slug), null, "Another page's published version is never rendered");
  for (const status of ["draft", "archived", "paused"]) {
    reset(); state.pages[0].status = status;
    assert.equal(await store.getPublishedLandingPageBySlug(metadata.slug), null, `${status} page remains nonpublic even with a retained published pointer`);
  }

  reset();
  const oldExact = await store.getLandingPageDraftPreview(ids.page, { versionId: ids.published, revision: 3 });
  assert.equal(oldExact.page.heroTitle, "Approved published headline");
  assert.equal(oldExact.revision, 3, "Exact saved preview uses its own saved revision, not the latest row revision");
  const exact = await store.getLandingPageDraftPreview(ids.page, { versionId: ids.draft, revision: 4 });
  assert.equal(exact.page.heroTitle, "New saved draft headline");
  assert.equal(exact.canPersist, false);
  assert.equal(await store.getLandingPageDraftPreview(ids.page, { versionId: ids.draft, revision: 3 }), null);
  assert.equal(await store.getLandingPageDraftPreview(ids.page, { versionId: "a7000000-0000-4000-8000-000000000099" }), null);
  state.versions[1].page_id = ids.otherPage;
  assert.equal(await store.getLandingPageDraftPreview(ids.page, { versionId: ids.draft }), null);

  reset(); state.moduleAllowed = false;
  assert.equal(await store.getLandingPageDraftPreview(ids.page, { versionId: ids.draft }), null,
    "Knowing a saved version ID never bypasses the landing-page module permission");

  reset(); state.access.brandIds = [ids.otherBrand];
  assert.equal(await store.getLandingPageEditorState(ids.page), null, "An editor cannot read another brand");
  assert.equal(await store.getLandingPageDraftPreview(ids.page, { versionId: ids.draft }), null);
  state.calls = [];
  assert.deepEqual((await store.getLandingPageList()).pages, []);
  assert.ok(!state.calls.includes("landing_page_versions"), "Out-of-scope page versions are never queried");

  for (const failure of ["landing_pages", "landing_page_versions", "truncated"]) {
    reset();
    if (failure === "truncated") state.truncated = true;
    else state.errors.add(failure);
    const unavailable = await store.getLandingPageList();
    assert.equal(unavailable.available, false, `${failure} must not masquerade as an empty/seed catalogue`);
    assert.equal(unavailable.canPersist, false);
    assert.deepEqual(unavailable.pages, []);
    if (failure !== "truncated") await assert.rejects(store.getPublishedLandingPageBySlug(metadata.slug), store.LandingPageReadError);
  }

  reset(); state.envReady = false; state.access = { source: "environment", accessLevel: "master", brandIds: [] };
  process.env.ALYSSA_E2E_FIXTURES = "1";
  const fixtures = await store.getLandingPageList();
  assert.equal(fixtures.source, "local_config");
  assert.equal(fixtures.available, true);
  assert.equal(fixtures.canPersist, false);
  assert.ok(fixtures.pages.length > 0, "Only explicit isolated fixture mode may expose seed pages");
  assert.deepEqual(state.calls, [], "Explicit fixture mode never calls the database");
} finally {
  console.warn = priorWarn;
  if (priorFixture === undefined) delete process.env.ALYSSA_E2E_FIXTURES;
  else process.env.ALYSSA_E2E_FIXTURES = priorFixture;
  if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = priorNodeEnv;
}
console.log("Landing page source availability, immutable public reads, exact previews and brand scope passed.");
