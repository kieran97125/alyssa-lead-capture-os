import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const config = (overrides = {}) => ({
  ok: true,
  form: { id: "current-form", public_form_token: "stable-token", default_treatment_id: "t", default_package_id: "p", default_branch_id: "b", allowed_domains: ["https://www.alyssa.hk"], conversion_mode: "form_submit_pixel", ...overrides.form },
  brand: { id: "brand", name: "Current Brand", slug: "alyssa", meta_pixel_id: "22222222", meta_pixel_pageview_on_embed: true, ...overrides.brand },
  treatments: [{ id: "t", name: "Verified treatment" }],
  packages: [{ id: "p", name: "Verified offer", treatment_id: "t", promo_price: 588, original_price: 1888, currency: "HKD", ...overrides.package }],
  branches: [{ id: "b", name: "Verified branch", is_default: true }],
});
const accepted = (overrides = {}) => ({ ok: true, lead_id: "accepted-lead", event_id: "accepted-event", form_id: "current-form", conversion_mode: "form_submit_pixel", value: 780, currency: "USD", ...overrides });

function harness(props = {}, { referrer = "https://www.alyssa.hk/offer", reply = accepted(), load = config(), embed = true, pixelThrows = false } = {}) {
  const calls = { fetch: [], storage: [], messages: [], beacons: [], fbq: [], identity: [], listeners: new Map() };
  const storage = () => {
    const values = new Map();
    return { getItem: key => { calls.storage.push(["read", key]); return values.get(key) ?? null; }, setItem: (key, value) => { calls.storage.push(["write", key]); values.set(key, value); }, removeItem: key => values.delete(key) };
  };
  const parent = { postMessage: (...args) => calls.messages.push(args), location: { href: "" } };
  const window = {
    parent, top: { location: { href: "" } }, location: new URL("https://public.example.test/embed/stable-token?utm_source=meta&utm_medium=cpc&utm_campaign=synthetic"),
    localStorage: storage(), sessionStorage: storage(), fbq: (...args) => { calls.fbq.push(args); if (pixelThrows) throw new Error("Synthetic blocked analytics"); },
    setTimeout: () => 1, clearTimeout() {},
    addEventListener: (name, fn) => calls.listeners.set(name, fn), removeEventListener: name => calls.listeners.delete(name), open() {},
  };
  const document = { referrer, cookie: "", title: "Synthetic test" };
  globalThis.window = window; globalThis.document = document;
  globalThis.fetch = async (url, init) => {
    calls.fetch.push([url, init?.body ? JSON.parse(init.body) : null]);
    if (String(url).startsWith("/api/public/forms/")) return { ok: load.ok, json: async () => load };
    if (url === "/api/public/leads") return { ok: reply.ok, json: async () => reply };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  let cursor = 0, changed = false, tree;
  const slots = new Map(), pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const effect = (callback, deps) => {
    const key = cursor++, old = slots.get(key);
    if (!old || !same(old.deps, deps)) { slots.set(key, { deps, cleanup: old?.cleanup }); pending.push(() => { old?.cleanup?.(); slots.get(key).cleanup = callback(); }); }
  };
  const hooks = {
    useState(initial) { const key = cursor++; if (!slots.has(key)) slots.set(key, typeof initial === "function" ? initial() : initial); return [slots.get(key), next => { const old = slots.get(key); const value = typeof next === "function" ? next(old) : next; if (!Object.is(old, value)) { slots.set(key, value); changed = true; } }]; },
    useRef(initial) { const key = cursor++; if (!slots.has(key)) slots.set(key, { current: initial }); return slots.get(key); },
    useMemo(callback, deps) { const key = cursor++, old = slots.get(key); if (!old || !same(old.deps, deps)) slots.set(key, { deps, value: callback() }); return slots.get(key).value; },
    useEffect: effect, useLayoutEffect: effect, useId: () => `synthetic-${cursor++}`,
  };
  const seed = config();
  const modules = new Map();
  const mocks = {
    react: hooks,
    "next/dynamic": { default: () => () => null },
    "@/lib/data/alyssaConfig": { alyssaDefaultForm: seed.form, alyssaTreatments: seed.treatments, alyssaPackages: seed.packages, alyssaBranches: seed.branches },
    "@/lib/capture/submissionIdentity": { getSubmissionIdentity: async (...args) => { calls.identity.push(args); return { id: "submission" }; }, clearSubmissionIdentity: () => {} },
    "@/lib/metaPixel/client": { getConfiguredMetaPixelIdForBrand: (_slug, id) => id, isMetaPixelDebugEnabled: () => false, sendMetaPixelBeacon: payload => { calls.beacons.push(payload); return { sent: true }; } },
  };
  function moduleAt(path) {
    if (modules.has(path)) return modules.get(path);
    const loaded = { exports: {} };
    modules.set(path, loaded.exports);
    const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function("require", "module", "exports", code)(name => mocks[name] ?? (name.startsWith("@/") ? moduleAt(`src/${name.slice(2)}.ts`) : require(name)), loaded, loaded.exports);
    modules.set(path, loaded.exports); return loaded.exports;
  }
  const { PublicLeadForm } = moduleAt("src/components/alyssa/PublicLeadForm.tsx");
  const input = { formToken: "stable-token", formId: "stale-install-id", brandSlug: "ineffable", initialConfig: config(), expectedParentOrigin: "https://www.alyssa.hk", mode: embed ? "embed" : "inline", conversionMode: "thank_you_redirect", successRedirectUrl: "https://www.ineffablebeautyhk.com/thankyou", ...props };
  const render = () => { cursor = 0; changed = false; tree = PublicLeadForm(input); return tree; };
  async function flush() { for (let attempt = 0; attempt < 12; attempt++) { if (!tree || changed) render(); while (pending.length) pending.shift()(); await new Promise(resolve => setImmediate(resolve)); if (!changed && !pending.length) return tree; } throw new Error("Component failed to settle"); }
  function nodes(node) { if (arguments.length === 0) node = tree; if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
  const find = (type, check = () => true) => nodes().find(node => node.type === type && check(node.props));
  async function fill() {
    find("input", p => ["你的姓名", "你的稱呼"].includes(p.placeholder)).props.onChange({ target: { value: "Synthetic" } });
    find("input", p => p.inputMode === "tel").props.onChange({ target: { value: "10000001" } });
    // The native and compact date fields both receive the actual update callback.
    nodes().find(node => typeof node.type === "function" && ["MobileDateField", "GosDateField"].includes(node.type.name)).props.onChange("2026-11-17");
    const time = find("select", p => p["aria-label"] === "預約時間") || nodes().find(node => typeof node.type === "function" && node.type.name === "GosTimeField");
    time.props.onChange(time.type === "select" ? { target: { value: "18:00" } } : "18:00");
    find("input", p => p.type === "checkbox").props.onChange({ currentTarget: { setCustomValidity() {} }, target: { checked: true } });
    await flush();
  }
  const submit = async () => { await find("form").props.onSubmit({ preventDefault() {} }); await flush(); };
  render();
  return { calls, window, find, nodes, flush, fill, submit, dispatch: event => calls.listeners.get("message")?.(event) };
}

const saved = { window: globalThis.window, document: globalThis.document, fetch: globalThis.fetch };
try {
  for (const compact of [false, true]) {
    const preview = harness({ previewMode: true, initialConfig: config({ brand: { slug: compact ? "gos" : "alyssa" } }) });
    await preview.flush();
    assert.equal(preview.find("fieldset").props.disabled, true);
    preview.find("input", p => p.inputMode === "tel").props.onChange({ target: { value: "10000001" } });
    await preview.submit();
    assert.deepEqual(preview.calls.fetch, [], "Preview never fetches config, events or leads, even with a direct submit event");
    assert.deepEqual(preview.calls.storage, [], "Preview never captures or reads/writes attribution storage");
    assert.deepEqual(preview.calls.messages, [], "Preview never handshakes or relays conversion");
    assert.deepEqual(preview.calls.identity, []); assert.deepEqual(preview.calls.beacons, []); assert.deepEqual(preview.calls.fbq, []);
  }
  const missingPreview = harness({ previewMode: true, initialConfig: undefined }); await missingPreview.flush();
  assert.deepEqual(missingPreview.calls.fetch, [], "Preview with unavailable configuration remains inert");

  const live = harness(); await live.flush();
  const handshake = live.calls.messages.find(([data]) => data.type === "launchhub:form-config");
  assert.equal(handshake[1], "https://www.alyssa.hk");
  assert.equal(handshake[0].brandSlug, "alyssa"); assert.equal(handshake[0].value, 588); assert.equal(handshake[0].pixelId, "22222222"); assert.equal(handshake[0].conversionMode, "form_submit_pixel"); assert.equal(handshake[0].successRedirectUrl, ""); assert.equal(handshake[0].pageViewOnEmbed, true);
  assert.ok(live.calls.fetch.some(([url, body]) => url === "/api/public/events" && body.event_type === "form_view"), "Normal public form still records its view");
  await live.fill(); await live.submit();
  const submitted = live.calls.fetch.find(([url]) => url === "/api/public/leads")[1];
  assert.equal(submitted.form_id, "current-form", "Verified token config owns identity despite stale installed form ID");
  const completion = live.calls.messages.filter(([data]) => data.type === "launchhub:form-submitted");
  assert.equal(completion.length, 1); assert.equal(completion[0][0].value, 780); assert.equal(completion[0][0].currency, "USD", "Persisted accepted receipt owns conversion amount/currency");
  assert.equal(live.window.top.location.href, "", "Stale redirect props cannot redirect a current Pixel form");

  const nested = harness({ initialConfig: config({ form: { conversion_mode: "thank_you_redirect", success_redirect_url: "https://www.alyssa.hk/thankyou" } }) }, { referrer: "https://component.filesusr.com/html", reply: accepted({ value: 0, currency: "HKD" }) }); await nested.flush();
  assert.equal(nested.calls.messages.find(([data]) => data.type === "launchhub:form-config")[1], "https://component.filesusr.com");
  nested.dispatch({ source: nested.window.parent, origin: "https://unrelated.example.test", data: { type: "launchhub_attribution_payload", schema_version: 1, payload: { submitted_touch_json: { utm_source: "spoofed" } } } });
  nested.dispatch({ source: nested.window.parent, origin: "https://component.filesusr.com", data: { type: "launchhub_attribution_payload", schema_version: 1, payload: { submitted_touch_json: { utm_source: "trusted-wix", utm_medium: "cpc", utm_campaign: "retained", current_page_url: "https://www.alyssa.hk/offer" } } } });
  await nested.flush(); await nested.fill(); await nested.submit();
  const nestedBody = nested.calls.fetch.find(([url]) => url === "/api/public/leads")[1];
  assert.equal(nestedBody.submitted_touch_json.utm_source, "trusted-wix", "Legitimate nested Wix attribution survives submission");
  const nestedCompletion = nested.calls.messages.filter(([data]) => data.type === "launchhub:form-submitted");
  assert.equal(nestedCompletion.length, 1); assert.equal(nestedCompletion[0][1], "https://component.filesusr.com"); assert.equal(nestedCompletion[0][0].value, 0, "Accepted explicit zero never falls back to the displayed paid offer");
  assert.ok(nested.calls.messages.every(([, origin]) => origin !== "*"), "Nested relay always targets the exact known immediate parent");

  const redirect = harness({}, { reply: accepted({ conversion_mode: "thank_you_redirect", success_redirect_url: "https://www.alyssa.hk/thankyou", value: 1280, currency: "HKD" }) }); await redirect.flush(); await redirect.fill(); await redirect.submit();
  const finalUrl = new URL(redirect.window.top.location.href);
  assert.equal(finalUrl.origin, "https://www.alyssa.hk"); assert.equal(finalUrl.searchParams.get("value"), "1280"); assert.equal(finalUrl.searchParams.get("form_id"), "current-form");
  assert.ok(!redirect.calls.messages.some(([data]) => data.type === "launchhub:form-submitted"), "Accepted redirect conversion suppresses a previously loaded Pixel conversion");
  const lastConfig = redirect.calls.messages.filter(([data]) => data.type === "launchhub:form-config").at(-1)[0];
  assert.equal(lastConfig.conversionMode, "thank_you_redirect"); assert.equal(lastConfig.value, 1280);

  const denied = harness({}, { referrer: "https://unrelated.example.test/iframe" }); await denied.flush();
  denied.dispatch({ source: denied.window.parent, origin: "https://unrelated.example.test", data: { type: "launchhub_attribution_payload", schema_version: 1, payload: { submitted_touch_json: { utm_source: "spoofed", utm_campaign: "fake" } } } });
  await denied.flush(); await denied.fill(); await denied.submit();
  assert.ok(!denied.calls.messages.some(([data]) => ["launchhub:form-config", "launchhub:form-submitted"].includes(data.type)), "An unrelated iframe intermediary cannot receive trusted config or conversion");
  assert.equal(denied.calls.fetch.find(([url]) => url === "/api/public/leads")[1].submitted_touch_json.utm_source, "meta", "The unrelated intermediary cannot replace captured attribution");

  const srcdoc = harness({ expectedParentOrigin: undefined }); await srcdoc.flush();
  assert.equal(srcdoc.calls.messages.find(([data]) => data.type === "launchhub:form-config")[1], "https://www.alyssa.hk", "A known allowlisted browser referrer independently authenticates a srcdoc wrapper without a serializable parent origin");
  srcdoc.dispatch({ source: srcdoc.window.parent, origin: "https://www.alyssa.hk", data: { type: "launchhub_attribution_payload", schema_version: 1, payload: { submitted_touch_json: { utm_source: "meta", utm_medium: "paid_social", utm_campaign: "srcdoc-proof", source_capture_method: "wix_page_code" } } } });
  await srcdoc.flush(); await srcdoc.fill(); await srcdoc.submit();
  assert.equal(srcdoc.calls.fetch.find(([url]) => url === "/api/public/leads")[1].submitted_touch_json.source_capture_method, "wix_page_code", "Authenticated srcdoc attribution retains the original Wix capture method");
  for (const referrer of ["https://unrelated.example.test/frame", "about:srcdoc", "https://component.filesusr.com/html", ""]) {
    const unverified = harness({ expectedParentOrigin: undefined }, { referrer }); await unverified.flush();
    unverified.dispatch({ source: unverified.window.parent, origin: referrer ? new URL(referrer).origin : "", data: { type: "launchhub_attribution_payload", schema_version: 1, payload: { submitted_touch_json: { utm_source: "spoofed", source_capture_method: "wix_page_code" } } } });
    await unverified.flush();
    assert.ok(!unverified.calls.messages.some(([data]) => data.type === "launchhub:form-config"), "Unallowlisted, opaque, missing and Wix sandbox origins without a verified real parent remain closed");
    assert.ok(!unverified.calls.fetch.some(([url, body]) => url === "/api/public/events" && body.event_type === "parent_attribution_captured"));
  }
  const unavailable = harness({ initialConfig: undefined }, { load: { ok: false } }); await unavailable.flush();
  assert.ok(!unavailable.calls.messages.some(([data]) => data.type === "launchhub:form-config")); assert.deepEqual(unavailable.calls.beacons, []);

  const inline = harness({ initialConfig: config({ form: { conversion_mode: "thank_you_redirect" } }) }, { embed: false, reply: accepted({ value: 0, currency: "HKD" }) }); await inline.flush(); await inline.fill(); await inline.submit();
  assert.equal(inline.calls.fbq.length, 1); assert.equal(inline.calls.fbq[0][2].value, 0); assert.equal(inline.calls.beacons[0].value, 0, "Inline completion also trusts the accepted zero despite loaded redirect mode");
  const blockedPixel = harness({}, { embed: false, pixelThrows: true }); await blockedPixel.flush(); await blockedPixel.fill(); await blockedPixel.submit();
  assert.ok(blockedPixel.nodes().some(node => node.props?.title === "已收到你的登記"), "Blocked browser analytics never revoke an accepted registration");
  for (const [promo, expected] of [[0, 0], [null, 1888], [-5, 0], ["invalid", 0]]) {
    const offer = harness({ initialConfig: config({ package: { promo_price: promo } }) }); await offer.flush();
    const message = offer.calls.messages.find(([data]) => data.type === "launchhub:form-config")[0];
    assert.equal(message.value, expected);
    if (expected === 0) assert.ok(!JSON.stringify(offer.nodes().filter(node => node.type === "p").map(node => node.props.children)).includes("HK$1888"), "Explicit zero/invalid promo is a neutral enquiry label");
  }
} finally {
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}
console.log("PASS: actual PublicLeadForm preview is inert; verified config overrides stale installed props; current and nested Wix attribution work; accepted conversion mode/value/currency control redirects and Pixel completions; explicit zero stays neutral.");
