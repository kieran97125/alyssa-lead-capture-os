import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function("require", "module", "exports", code)(name => mocks[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}

const brandOperations = load("src/lib/data/brandOperations.ts", {
  "@/lib/data/configuration": {},
  "@/lib/data/appUrl": { getPublicPathUrl: path => `https://public.example.test${path}` },
  "@/lib/data/brandDefaults": {},
  "@/lib/metaPixel/configuration": {},
});
const form = { id: "form-id", publicFormToken: "stable-public-token" };
const snippet = brandOperations.buildWixEmbedCode({ form, brandSlug: "alyssa", pixelId: "11111111", eventValue: 388, conversionMode: "thank_you_redirect", successRedirectUrl: "https://www.alyssa.hk/thankyou" });
assert.match(snippet, /data-form-token="stable-public-token"/);
assert.match(snippet, /data-target=/);
for (const name of ["data-form-id", "data-brand=", "data-pixel-id", "data-pixel-event-value", "data-success-redirect-url", "data-conversion-mode"]) assert.ok(!snippet.includes(name), `Installed code must not freeze ${name}`);
assert.equal(brandOperations.buildWixEmbedCode({ form, brandSlug: "alyssa", eventValue: 0 }), brandOperations.buildWixEmbedCode({ form, brandSlug: "alyssa", eventValue: 999 }), "Changing an offer does not require replacing installed code");

const { WixSetupPanel } = load("src/components/acquisition/WixSetupPanel.tsx", {
  react: { useEffect() {}, useId: () => "wix-setup", useRef: value => ({ current: value }), useState: value => [value, () => {}] },
  "@/components/system/SystemButton": { SystemButton: "button" },
  "@/components/system/SystemDetails": { SystemDetails: "details" },
});
function linksIn(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(linksIn);
  return [node.type === "a" ? node.props.href : null, ...linksIn(node.props?.render), ...linksIn(node.props?.children)].filter(Boolean);
}
const panelInput = { formName: "Synthetic", embedCode: snippet, wixAttributionBridgeCode: "synthetic bridge", previewUrl: "/forms/form-123/preview", placementUrl: "https://www.example.test/offer" };
assert.deepEqual(linksIn(WixSetupPanel(panelInput)), ["/forms/form-123/preview", "https://www.example.test/offer"], "Protected inert preview remains usable beside the public website");
for (const unsafe of ["//evil.example.test/preview", "javascript:alert(1)", "/forms/../preview", "/forms/id%2fsecret/preview", "/forms/form-123/preview?redirect=evil"]) {
  assert.deepEqual(linksIn(WixSetupPanel({ ...panelInput, previewUrl: unsafe, placementUrl: "javascript:alert(1)" })), [], "Malformed preview/website links are not rendered");
}

function browser({ dynamic = false, referrer = "https://www.alyssa.hk/offer", attributes = {} } = {}) {
  const listeners = new Map(), nodes = new Map(), scripts = [], beacons = [], messages = [], errors = [];
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.style = {}; this.attributes = {}; this.children = []; this.events = {}; this._html = ""; if (tag === "iframe") this.contentWindow = { postMessage: (...args) => messages.push(args) }; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    appendChild(node) { this.children.push(node); node.parentNode = this; if (node.tagName === "SCRIPT") scripts.push(node); return node; }
    removeChild(node) { this.children = this.children.filter(value => value !== node); node.parentNode = null; }
    insertBefore(node) { return this.appendChild(node); }
    addEventListener(name, listener) { this.events[name] = listener; }
    querySelector(selector) { return selector === "iframe" ? this.children.find(value => value.tagName === "IFRAME") ?? (this.simulatedIframe ? {} : null) : null; }
    set innerHTML(value) { this._html = value; this.children = []; this.simulatedIframe = false; }
    get innerHTML() { return this._html; }
  }
  const target = new Node("div"), otherTarget = new Node("div"), body = new Node("body"), script = new Node("script");
  nodes.set("target", target); nodes.set("launchhub-dynamic-form-root", target); nodes.set("other", otherTarget);
  script.src = "https://public.example.test/embed/alyssa-form.js?v=old";
  Object.assign(script.attributes, { "data-form-token": "stable-public-token", "data-target": "#target", ...attributes }); body.appendChild(script);
  const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };
  const parent = { postMessage: (...args) => messages.push(args) };
  const window = { parent, top: { location: { href: "" }, postMessage() {} }, location: new URL("https://component.filesusr.com/html?utm_source=meta"), localStorage: storage(), sessionStorage: storage(), setTimeout: () => 1, addEventListener: (name, fn) => listeners.set(name, fn), dispatchEvent() {}, open() {} };
  const document = { currentScript: script, referrer, cookie: "", title: "Synthetic embed", body, createElement: tag => new Node(tag), getElementById: id => nodes.get(id) ?? null, querySelector: selector => nodes.get(selector.replace(/^#/, "")) ?? null };
  const context = { window, document, URL, URLSearchParams, console: { info() {}, error: (...args) => errors.push(args) }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }, Image: class { set src(value) { beacons.push(value); } } };
  vm.runInNewContext(readFileSync(new URL(`../public/embed/${dynamic ? "launchhub-dynamic-form" : "alyssa-form"}.js`, import.meta.url), "utf8"), context);
  assert.deepEqual(errors, [], "The actual public script initializes without a browser exception");
  return { window, document, parent, target, otherTarget, scripts, beacons, messages, dispatch: event => listeners.get("message")?.(event), iframe: () => target.children.find(node => node.tagName === "IFRAME") };
}

const dynamic = browser({ dynamic: true });
const configure = { type: "launchhub:configure-form", payload: { formToken: "stable-public-token", brand: "alyssa" } };
const initialScripts = dynamic.scripts.length;
dynamic.dispatch({ source: {}, origin: "https://www.alyssa.hk", data: configure });
dynamic.dispatch({ source: dynamic.parent, origin: "https://unrelated.example.test", data: configure });
assert.equal(dynamic.scripts.length, initialScripts, "Unrelated windows/origins cannot replace the dynamic form");
dynamic.dispatch({ source: dynamic.parent, origin: "https://www.alyssa.hk", data: configure });
assert.equal(dynamic.scripts.length, initialScripts + 1);
dynamic.target.simulatedIframe = true;
dynamic.dispatch({ source: dynamic.parent, origin: "https://www.alyssa.hk", data: { ...configure, payload: { ...configure.payload, brand: "gos" } } });
assert.equal(dynamic.scripts.length, initialScripts + 2, "Brand changes invalidate loader identity");
dynamic.otherTarget.simulatedIframe = true;
dynamic.dispatch({ source: dynamic.parent, origin: "https://www.alyssa.hk", data: { ...configure, payload: { ...configure.payload, targetId: "other", brand: "gos" } } });
assert.equal(dynamic.scripts.length, initialScripts + 3, "Target changes invalidate loader identity");
assert.equal(dynamic.target.children.length, 0, "A moved single dynamic form does not leave an active old iframe");
assert.equal(dynamic.scripts[1].attributes["data-launchhub-cancelled"], "true", "Superseded async script cannot initialize an old form later");
const currentChildren = dynamic.otherTarget.children.length;
dynamic.scripts[1].events.error();
assert.equal(dynamic.otherTarget.children.length, currentChildren, "A late old-script failure does not replace the current form");
assert.equal(dynamic.target.children.length, 0, "A late old-script failure does not revive the retired target");
dynamic.window.LaunchHubDynamicForm.configure({ formToken: "", targetId: "target" });
assert.equal(dynamic.otherTarget.children.length, 0, "A missing-token reconfiguration also retires the previous active target");
const neutral = browser({ dynamic: true });
neutral.window.LaunchHubDynamicForm.configure({ formToken: "stable-public-token" });
assert.equal(neutral.scripts.at(-1).attributes["data-brand"], "", "No copied Ineffable fallback");
const noReferrer = browser({ dynamic: true, referrer: "" });
noReferrer.dispatch({ source: noReferrer.parent, origin: "https://www.alyssa.hk", data: configure });
assert.equal(noReferrer.scripts.length, 1, "Missing trusted origin fails closed");
noReferrer.window.LaunchHubDynamicForm.configure(configure.payload);
assert.equal(noReferrer.scripts.length, 2, "First-party direct configuration remains available");
assert.equal(browser({ attributes: { "data-launchhub-cancelled": "true" } }).iframe(), undefined, "A superseded loader script that finishes downloading remains inert");

const installed = browser({ attributes: { "data-pixel-id": "11111111", "data-pixel-event-value": "388", "data-pixel-pageview": "true" } });
const iframe = installed.iframe(); assert.ok(iframe);
const submitted = { type: "launchhub:form-submitted", event: "CompleteRegistration", formToken: "stable-public-token", value: 588, currency: "HKD" };
installed.dispatch({ source: iframe.contentWindow, origin: "https://public.example.test", data: submitted });
assert.equal(installed.beacons.length, 0, "Baked old settings cannot record a conversion or PageView before verified config");
const serverConfig = { type: "launchhub:form-config", source: "launchhub-form", formToken: "stable-public-token", brandSlug: "alyssa", pixelId: "22222222", value: 588, currency: "HKD", conversionMode: "form_submit_pixel", successRedirectUrl: "", pageViewOnEmbed: true };
for (const event of [{ source: {}, origin: "https://public.example.test", data: serverConfig }, { source: iframe.contentWindow, origin: "https://unrelated.example.test", data: serverConfig }, { source: iframe.contentWindow, origin: "https://public.example.test", data: { ...serverConfig, formToken: "other-form" } }]) installed.dispatch(event);
assert.equal(installed.beacons.length, 0, "Config requires exact iframe origin/window/token");
installed.dispatch({ source: iframe.contentWindow, origin: "https://public.example.test", data: serverConfig });
assert.equal(installed.beacons.length, 1);
assert.equal(new URL(installed.beacons[0]).searchParams.get("id"), "22222222");
installed.dispatch({ source: iframe.contentWindow, origin: "https://public.example.test", data: submitted });
installed.dispatch({ source: iframe.contentWindow, origin: "https://public.example.test", data: submitted });
assert.equal(installed.beacons.length, 2, "Actual completion records once even if relayed twice");
assert.equal(new URL(installed.beacons[1]).searchParams.get("id"), "22222222");
assert.equal(new URL(installed.beacons[1]).searchParams.get("cd[value]"), "588");
const redirected = browser({ attributes: { "data-pixel-id": "11111111" } });
redirected.dispatch({ source: redirected.iframe().contentWindow, origin: "https://public.example.test", data: { ...serverConfig, conversionMode: "thank_you_redirect", successRedirectUrl: "https://www.alyssa.hk/thankyou", pageViewOnEmbed: false } });
redirected.dispatch({ source: redirected.iframe().contentWindow, origin: "https://public.example.test", data: submitted });
assert.equal(redirected.beacons.length, 0, "Current redirect conversion mode suppresses a stale embedded conversion beacon");
redirected.dispatch({ source: redirected.iframe().contentWindow, origin: "https://public.example.test", data: { type: "launchhub:success-redirect", source: "launchhub-form", formToken: "stable-public-token", redirectUrl: "https://www.alyssa.hk/thankyou?value=588" } });
assert.equal(redirected.window.top.location.href, "https://www.alyssa.hk/thankyou?value=588");

const previous = { node: process.env.NODE_ENV, fixtures: process.env.ALYSSA_E2E_FIXTURES };
let envReady = true;
const cache = new Map();
const errors = new Map();
const records = {
  forms: [{ id: "form", public_form_token: "stable-token", brand_id: "brand", status: "active", default_treatment_id: "treatment", default_package_id: "package", default_branch_id: "branch", package_selection_mode: "fixed" }],
  brands: [{ id: "brand", name: "Synthetic", slug: "synthetic", meta_pixel_pageview_on_embed: true }],
  treatments: [{ id: "treatment", brand_id: "brand", name: "Synthetic", status: "active" }],
  packages: [{ id: "package", treatment_id: "treatment", name: "Synthetic", status: "active" }],
  branches: [{ id: "branch", brand_id: "brand", name: "Synthetic", status: "active" }],
  form_packages: [], form_branches: [],
};
function query(table) {
  const filters = []; let single = false;
  const q = { select() { return q; }, eq(k, v) { filters.push(row => row[k] === v); return q; }, in(k, vs) { filters.push(row => vs.includes(row[k])); return q; }, order() { return q; }, single() { single = true; return q; }, then(resolve, reject) { const rows = (records[table] || []).filter(row => filters.every(filter => filter(row))); return Promise.resolve({ data: single ? rows[0] ?? null : rows, error: errors.get(table) || null }).then(resolve, reject); } }; return q;
}
const publicConfig = load("src/lib/data/publicFormConfig.ts", {
  "server-only": {},
  "next/cache": { unstable_cache: fn => async token => { if (cache.has(token)) return cache.get(token); const result = await fn(token); cache.set(token, result); return result; } },
  "@/lib/data/alyssaConfig": { alyssaDefaultForm: { id: "seed", publicFormToken: "seed-token" }, alyssaBrand: {}, alyssaTreatments: [], alyssaPackages: [], alyssaBranches: [] },
  "@/lib/supabase/admin": { hasSupabaseAdminEnv: () => envReady, createSupabaseAdminClient: () => ({ from: query }) },
});
try {
  process.env.NODE_ENV = "production"; delete process.env.ALYSSA_E2E_FIXTURES;
  envReady = false;
  assert.equal((await publicConfig.getPublicFormConfig("seed-token")).status, 503, "Production missing DB never substitutes a local form");
  process.env.ALYSSA_E2E_FIXTURES = "1";
  assert.equal((await publicConfig.getPublicFormConfig("seed-token")).body.mode, "local_seed", "Explicit isolated fixtures remain supported");
  delete process.env.ALYSSA_E2E_FIXTURES; envReady = true; cache.clear();
  assert.equal((await publicConfig.getPublicFormConfig("not-found")).status, 404);
  for (const table of ["forms", "brands", "treatments", "branches", "form_packages", "form_branches", "packages"]) {
    cache.clear(); errors.set(table, { code: "SYNTHETIC_STORAGE_ERROR" });
    assert.equal((await publicConfig.getPublicFormConfig("stable-token")).status, 503, `${table} failure cannot pretend to be a complete configuration`);
    errors.delete(table);
    assert.equal((await publicConfig.getPublicFormConfig("stable-token")).status, 200, `${table} outage result was not cached; retry recovers`);
  }
  cache.clear(); records.forms[0].status = "archived";
  assert.equal((await publicConfig.getPublicFormConfig("stable-token")).status, 410);
  records.forms[0].status = "active"; cache.clear();
  const ok = await publicConfig.getPublicFormConfig("stable-token");
  assert.equal(ok.status, 200); assert.equal(ok.body.branches.length, 1); assert.equal(ok.body.packages.length, 1); assert.equal(ok.body.brand.meta_pixel_pageview_on_embed, true);
  cache.clear(); const saved = records.branches; records.branches = [];
  assert.equal((await publicConfig.getPublicFormConfig("stable-token")).status, 503, "Missing active branch fails clearly");
  records.branches = saved;
} finally {
  if (previous.node === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.node;
  if (previous.fixtures === undefined) delete process.env.ALYSSA_E2E_FIXTURES; else process.env.ALYSSA_E2E_FIXTURES = previous.fixtures;
}
console.log("PASS: stable token-only install, actual legacy loader/verified configuration/one conversion, trusted Wix dynamic sender, and fail-closed uncached transient public config recovery; no external writes.");
