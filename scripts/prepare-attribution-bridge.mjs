import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function patchFile(relativePath, transform) {
  const target = path.join(repoRoot, relativePath);
  const source = await readFile(target, "utf8");
  const next = transform(source);
  if (next === source) {
    // Every required replacement validates its source block before returning.
    // A no-op here therefore means the file is already fully prepared, which
    // is expected when build and Playwright verification run back-to-back.
    console.log(`${relativePath}: attribution already prepared`);
    return;
  }
  await writeFile(target, next, "utf8");
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`Missing ${label}: ${from.slice(0, 120)}`);
  }
  return source.replace(from, to);
}

function replaceRegexRequired(source, pattern, to, label) {
  if (source.includes(to)) return source;
  if (!pattern.test(source)) throw new Error(`Missing regex block: ${label}`);
  return source.replace(pattern, to);
}

await patchFile("src/components/alyssa/PublicLeadForm.tsx", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `} from "@/lib/attribution/publicAttributionCookie";\n`,
    `} from "@/lib/attribution/publicAttributionCookie";\nimport {\n  ATTRIBUTION_BRIDGE_SCHEMA_VERSION,\n  ATTRIBUTION_PAYLOAD_MESSAGE_TYPES,\n  ATTRIBUTION_READY_MESSAGE_TYPES,\n  attributionMessageHasSupportedSchema,\n  hasAttributionEnvelopeTracking,\n  mergeAttributionEnvelopes,\n  normalizeAttributionEnvelope,\n  persistAttributionEnvelope,\n} from "@/lib/attribution/bridge";\n`,
    "PublicLeadForm attribution bridge import"
  );

  source = replaceRequired(
    source,
    `  const conversionEventSentRef = useRef(false);\n  const [attribution, setAttribution] = useState<AttributionEnvelope>({});`,
    `  // LAUNCHHUB_ATTRIBUTION_BRIDGE_V2\n  const conversionEventSentRef = useRef(false);\n  const attributionRef = useRef<AttributionEnvelope>({});\n  const parentAttributionRef = useRef<AttributionEnvelope | null>(null);\n  const bridgeWaitersRef = useRef<\n    Array<(value: AttributionEnvelope | null) => void>\n  >([]);\n  const [attribution, setAttribution] = useState<AttributionEnvelope>({});`,
    "PublicLeadForm attribution refs"
  );

  source = replaceRequired(
    source,
    `async function logPublicEvent(\n`,
    `function getImmediateParentTargetOrigin(\n  expectedParentOrigin: string | undefined\n) {\n  if (typeof document === "undefined") return null;\n  return (\n    normalizeOrigin(document.referrer) || normalizeOrigin(expectedParentOrigin)\n  );\n}\n\nfunction postAttributionReadyMessages(\n  expectedParentOrigin: string | undefined,\n  formToken: string\n) {\n  if (typeof window === "undefined") return;\n  if (!window.parent || window.parent === window) return;\n  const targetOrigin = getImmediateParentTargetOrigin(expectedParentOrigin);\n  if (!targetOrigin) return;\n\n  ATTRIBUTION_READY_MESSAGE_TYPES.forEach((type) => {\n    window.parent.postMessage(\n      {\n        type,\n        schema_version: ATTRIBUTION_BRIDGE_SCHEMA_VERSION,\n        form_token: formToken,\n      },\n      targetOrigin\n    );\n  });\n}\n\nasync function logPublicEvent(\n`,
    "PublicLeadForm ready helpers"
  );

  source = replaceRequired(
    source,
    `  const effectiveSuccessRedirectUrl =\n    successRedirectUrl || publicForm.successRedirectUrl || "";\n\n  function buildThankYouRedirectUrl({`,
    `  const effectiveSuccessRedirectUrl =\n    successRedirectUrl || publicForm.successRedirectUrl || "";\n\n  async function waitForParentAttribution(\n    selfAttribution: AttributionEnvelope\n  ): Promise<AttributionEnvelope | null> {\n    if (\n      !isEmbed ||\n      typeof window === "undefined" ||\n      !window.parent ||\n      window.parent === window ||\n      parentAttributionRef.current ||\n      hasAttributionEnvelopeTracking(selfAttribution)\n    ) {\n      return parentAttributionRef.current;\n    }\n\n    return new Promise((resolve) => {\n      let settled = false;\n      const finish = (value: AttributionEnvelope | null) => {\n        if (settled) return;\n        settled = true;\n        resolve(value);\n      };\n      bridgeWaitersRef.current.push(finish);\n      postAttributionReadyMessages(expectedParentOrigin, formToken);\n      window.setTimeout(() => finish(parentAttributionRef.current), 700);\n    });\n  }\n\n  function buildThankYouRedirectUrl({`,
    "PublicLeadForm bridge wait"
  );

  source = replaceRequired(
    source,
    `    queueMicrotask(() => setAttribution(initialAttribution));\n`,
    `    attributionRef.current = initialAttribution;\n    queueMicrotask(() => setAttribution(initialAttribution));\n`,
    "PublicLeadForm initial attribution ref"
  );

  source = replaceRegexRequired(
    source,
    /    function onMessage\(event: MessageEvent\) \{[\s\S]*?    return \(\) => window\.removeEventListener\("message", onMessage\);/,
    `    function onMessage(event: MessageEvent) {\n      if (\n        !window.parent ||\n        window.parent === window ||\n        event.source !== window.parent\n      ) {\n        return;\n      }\n\n      const immediateParentOrigin = normalizeOrigin(document.referrer);\n      const receivedOrigin = normalizeOrigin(event.origin);\n      if (immediateParentOrigin && receivedOrigin !== immediateParentOrigin) return;\n      if (\n        !immediateParentOrigin &&\n        expectedParentOrigin &&\n        receivedOrigin !== normalizeOrigin(expectedParentOrigin)\n      ) {\n        return;\n      }\n\n      if (!ATTRIBUTION_PAYLOAD_MESSAGE_TYPES.has(event.data?.type)) return;\n      if (!attributionMessageHasSupportedSchema(event.data)) return;\n\n      const nextAttribution = normalizeAttributionEnvelope(\n        event.data?.payload || {}\n      ) as AttributionEnvelope;\n      if (!hasAttributionEnvelopeTracking(nextAttribution)) return;\n\n      persistAttributionEnvelope(nextAttribution);\n      parentAttributionRef.current = nextAttribution;\n      const mergedAttribution = mergeAttributionEnvelopes(\n        attributionRef.current,\n        nextAttribution\n      ) as AttributionEnvelope;\n      attributionRef.current = mergedAttribution;\n      setAttribution(mergedAttribution);\n      bridgeWaitersRef.current.splice(0).forEach((resolve) =>\n        resolve(nextAttribution)\n      );\n\n      void logPublicEvent(\n        "parent_attribution_captured",\n        {\n          schema_version: event.data?.schema_version || 1,\n          tracking_received: true,\n          capture_method: getString(\n            nextAttribution.submitted_touch_json?.source_capture_method\n          ),\n        },\n        mergedAttribution\n      );\n    }\n\n    window.addEventListener("message", onMessage);\n    postAttributionReadyMessages(expectedParentOrigin, formToken);\n    const readyTimers = [250, 1000].map((delay) =>\n      window.setTimeout(\n        () => postAttributionReadyMessages(expectedParentOrigin, formToken),\n        delay\n      )\n    );\n\n    return () => {\n      readyTimers.forEach((timer) => window.clearTimeout(timer));\n      window.removeEventListener("message", onMessage);\n    };`,
    "PublicLeadForm parent message listener"
  );

  source = replaceRequired(
    source,
    `    const liveAttribution = captureCurrentPageAttribution({\n      formToken,\n      formId: formId || publicForm.id,\n      brandSlug: brand.slug || brandSlug || "alyssa",\n      initialQueryString,\n      serverInitialAttribution,\n    });\n    queueMicrotask(() => setAttribution(liveAttribution));`,
    `    let liveAttribution = captureCurrentPageAttribution({\n      formToken,\n      formId: formId || publicForm.id,\n      brandSlug: brand.slug || brandSlug || "alyssa",\n      initialQueryString,\n      serverInitialAttribution,\n    });\n    attributionRef.current = liveAttribution;\n    queueMicrotask(() => setAttribution(liveAttribution));`,
    "PublicLeadForm live attribution capture"
  );

  source = replaceRequired(
    source,
    `    setState("loading");\n    setMessage("正在提交預約資料...");`,
    `    const parentAttribution = await waitForParentAttribution(liveAttribution);\n    liveAttribution = mergeAttributionEnvelopes(\n      liveAttribution,\n      parentAttribution || parentAttributionRef.current\n    ) as AttributionEnvelope;\n    attributionRef.current = liveAttribution;\n    queueMicrotask(() => setAttribution(liveAttribution));\n\n    setState("loading");\n    setMessage("正在提交預約資料...");`,
    "PublicLeadForm submit bridge merge"
  );

  return source;
});

await patchFile("public/embed/alyssa-form.js", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `    return output;\n  }\n\n  function hasKeys(value) {`,
    `    return output;\n  }\n\n  // LAUNCHHUB_ATTRIBUTION_BRIDGE_V2\n  function mergeTouchPayload(base, incoming) {\n    var output = normalizeAttributionFields(Object.assign({}, base || {}));\n    var next = normalizeAttributionFields(Object.assign({}, incoming || {}));\n    Object.keys(next).forEach(function (key) {\n      var value = next[key];\n      if (typeof value === "string") {\n        if (value.trim()) output[key] = value.trim();\n      } else if (value !== null && value !== undefined && typeof value !== "object") {\n        output[key] = value;\n      }\n    });\n    return normalizeAttributionFields(output);\n  }\n\n  function normalizeEnvelopePayload(value) {\n    var envelope = value && typeof value === "object" ? value : {};\n    return {\n      first_touch_json: normalizeAttributionFields(envelope.first_touch_json || {}),\n      latest_touch_json: normalizeAttributionFields(envelope.latest_touch_json || {}),\n      submitted_touch_json: normalizeAttributionFields(envelope.submitted_touch_json || {})\n    };\n  }\n\n  function envelopeHasTracking(envelope) {\n    return [\n      envelope && envelope.submitted_touch_json,\n      envelope && envelope.latest_touch_json,\n      envelope && envelope.first_touch_json\n    ].some(function (touch) {\n      if (!touch) return false;\n      return ATTRIBUTION_KEYS.some(function (key) { return Boolean(touch[key]); });\n    });\n  }\n\n  function hasKeys(value) {`,
    "embed bridge helpers"
  );

  source = replaceRequired(
    source,
    `    var parentPageUrl = getRealParentPageUrl();\n    var parentOrigin = getOrigin(parentPageUrl) || window.location.origin;`,
    `    var parentPageUrl = getRealParentPageUrl();\n    var parentOrigin = getOrigin(parentPageUrl) || window.location.origin;\n    var wixParentOrigin = getOrigin(document.referrer);`,
    "embed Wix parent origin"
  );

  source = replaceRequired(
    source,
    `    var debugPayload = {\n`,
    `    function applyParentAttributionEnvelope(envelopeValue) {\n      var envelope = normalizeEnvelopePayload(envelopeValue);\n      if (!envelopeHasTracking(envelope)) return false;\n\n      if (envelopeHasTracking({ first_touch_json: envelope.first_touch_json })) {\n        firstTouch = envelope.first_touch_json;\n      }\n      latestTouch = mergeTouchPayload(latestTouch, envelope.latest_touch_json);\n      submittedTouch = mergeTouchPayload(\n        mergeTouchPayload(submittedTouch, envelope.latest_touch_json),\n        envelope.submitted_touch_json\n      );\n      submittedTouch.source_capture_method =\n        submittedTouch.source_capture_method || "wix_page_code";\n      latestTouch.source_capture_method =\n        latestTouch.source_capture_method || "wix_page_code";\n\n      parentPageUrl =\n        submittedTouch.parent_url ||\n        submittedTouch.current_page_url ||\n        latestTouch.parent_url ||\n        latestTouch.current_page_url ||\n        parentPageUrl;\n      parentOrigin =\n        submittedTouch.parent_origin || getOrigin(parentPageUrl) || parentOrigin;\n\n      writeStorage(localKey, firstTouch, window.localStorage);\n      writeStorage(sessionKey, latestTouch, window.sessionStorage);\n      var lockedTouch = hasKeys(submittedTouch) ? submittedTouch : latestTouch;\n      writeStorage("launchhub_locked_attribution", lockedTouch, window.localStorage);\n      writeStorage("launchhub_locked_attribution", lockedTouch, window.sessionStorage);\n\n      if (typeof iframeUrl !== "undefined" && iframeUrl) {\n        Object.keys(submittedTouch).forEach(function (key) {\n          if (ATTRIBUTION_KEYS.indexOf(key) !== -1 && submittedTouch[key]) {\n            iframeUrl.searchParams.set(key, submittedTouch[key]);\n          }\n        });\n        if (parentPageUrl) iframeUrl.searchParams.set("parent_url", parentPageUrl);\n        if (parentOrigin) iframeUrl.searchParams.set("parent_origin", parentOrigin);\n      }\n\n      debugClassification = classifyDebugPayload(submittedTouch);\n      submittedTouch.tracking_status = debugClassification.tracking_status;\n      submittedTouch.audit_reason = debugClassification.audit_reason;\n      sendAttribution();\n      return true;\n    }\n\n    function requestWixParentAttribution() {\n      if (!window.parent || window.parent === window || !wixParentOrigin) return;\n      window.parent.postMessage(\n        {\n          type: "launchhub_wix_attribution_ready",\n          schema_version: 1,\n          form_token: formToken\n        },\n        wixParentOrigin\n      );\n    }\n\n    var debugPayload = {\n`,
    "embed parent envelope application"
  );

  source = replaceRegexRequired(
    source,
    /    function sendAttribution\(\) \{[\s\S]*?    \}\n\n    function fireCompleteRegistrationBeacon/,
    `    function sendAttribution() {\n      if (!iframe.contentWindow) return;\n      var envelope = {\n        first_touch_json: firstTouch,\n        latest_touch_json: latestTouch,\n        submitted_touch_json: submittedTouch\n      };\n      iframe.contentWindow.postMessage(\n        { type: "alyssa_attribution_payload", payload: envelope },\n        embedOrigin\n      );\n      iframe.contentWindow.postMessage(\n        {\n          type: "launchhub_attribution_payload",\n          schema_version: 1,\n          payload: envelope\n        },\n        embedOrigin\n      );\n    }\n\n    function fireCompleteRegistrationBeacon`,
    "embed inner attribution sender"
  );

  source = replaceRegexRequired(
    source,
    /    iframe\.addEventListener\("load", sendAttribution\);\n    window\.addEventListener\("message", function \(event\) \{[\s\S]*?    \}\);\n\n    var target =/,
    `    iframe.addEventListener("load", sendAttribution);\n    window.addEventListener("message", function (event) {\n      var data = event.data || {};\n      var isWixAttributionMessage =\n        event.source === window.parent &&\n        (data.type === "launchhub_attribution_payload" ||\n          data.type === "alyssa_attribution_payload");\n\n      if (isWixAttributionMessage) {\n        if (wixParentOrigin && event.origin !== wixParentOrigin) return;\n        if (data.schema_version !== undefined && data.schema_version !== 1) return;\n        applyParentAttributionEnvelope(data.payload || {});\n        return;\n      }\n\n      if (event.origin !== embedOrigin || event.source !== iframe.contentWindow) return;\n      if (\n        data.type === "launchhub:resize" &&\n        data.source === "launchhub-form" &&\n        (!data.formToken || data.formToken === formToken)\n      ) {\n        var nextHeight = clampEmbedHeight(data.height);\n        iframe.height = String(nextHeight);\n        iframe.style.height = nextHeight + "px";\n      }\n      if (\n        data.type === "alyssa_iframe_ready" ||\n        data.type === "launchhub_iframe_ready"\n      ) {\n        sendAttribution();\n      }\n      if (\n        data.type === "launchhub:success-redirect" &&\n        data.source === "launchhub-form" &&\n        data.formToken === formToken\n      ) {\n        if (successRedirectStarted) return;\n        successRedirectStarted = true;\n\n        var finalRedirectUrl = data.redirectUrl || successRedirectUrl;\n        var redirected = navigateTopToSuccessUrl(finalRedirectUrl, brand);\n\n        if (!redirected && iframe.contentWindow) {\n          iframe.contentWindow.postMessage(\n            {\n              type: "launchhub:redirect-blocked",\n              source: "launchhub-embed",\n              redirectUrl: isAllowedSuccessRedirectUrl(finalRedirectUrl, brand)\n                ? finalRedirectUrl\n                : ""\n            },\n            embedOrigin\n          );\n        }\n      }\n      if (\n        data.type === "launchhub:form-submitted" &&\n        data.event === "CompleteRegistration"\n      ) {\n        fireCompleteRegistrationBeacon(data);\n\n        if (window.parent && window.parent !== window) {\n          window.parent.postMessage(data, wixParentOrigin || "*");\n        }\n        if (\n          window.top &&\n          window.top !== window &&\n          window.top !== window.parent\n        ) {\n          window.top.postMessage(data, wixParentOrigin || "*");\n        }\n      }\n    });\n    requestWixParentAttribution();\n    [250, 1000, 2500].forEach(function (delay) {\n      window.setTimeout(requestWixParentAttribution, delay);\n    });\n\n    var target =`,
    "embed message router"
  );

  return source;
});

await patchFile("src/app/api/public/leads/route.ts", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `import { TouchPayload } from "@/lib/attribution/types";\n`,
    `import { TouchPayload } from "@/lib/attribution/types";\nimport {\n  createAttributionTraceSummary,\n  createSanitizedAttributionPayload,\n} from "@/lib/attribution/telemetry";\n`,
    "lead API telemetry import"
  );

  source = replaceRequired(
    source,
    `  submittedTouchOverride?: TouchPayload,\n  attributionDebug?: ReturnType<typeof createAttributionDebugPayload>\n) {`,
    `  submittedTouchOverride?: TouchPayload,\n  attributionDebug?: ReturnType<typeof createAttributionDebugPayload>,\n  attributionTraceId = randomUUID()\n) {`,
    "local response trace argument"
  );

  source = replaceRequired(
    source,
    `      source_snapshot_id: randomUUID(),\n      source_type: classification.sourceType,`,
    `      source_snapshot_id: randomUUID(),\n      attribution_trace_id: attributionTraceId,\n      source_type: classification.sourceType,`,
    "local response trace field"
  );

  source = replaceRequired(
    source,
    `  const submittedTouch = resolvedAttribution.submittedTouch;\n  const classification = classifySubmittedTouch(submittedTouch);\n  const attributionDebug = shouldReturnAttributionDebug(`,
    `  const submittedTouch = resolvedAttribution.submittedTouch;\n  const classification = classifySubmittedTouch(submittedTouch);\n  const attributionTraceId = randomUUID();\n  const attributionTraceSummary = createAttributionTraceSummary({\n    traceId: attributionTraceId,\n    sourceUsed: resolvedAttribution.sourceUsed,\n    touch: submittedTouch,\n    classification,\n  });\n  console.info("[LaunchHub] attribution_resolved", attributionTraceSummary);\n  const attributionDebug = shouldReturnAttributionDebug(`,
    "lead API trace creation"
  );

  source = replaceRequired(
    source,
    `    return createLocalResponse(payload, submittedTouch, attributionDebug);`,
    `    return createLocalResponse(\n      payload,\n      submittedTouch,\n      attributionDebug,\n      attributionTraceId\n    );`,
    "local response trace forwarding"
  );

  source = replaceRequired(
    source,
    `      raw_payload_json: payload,`,
    `      raw_payload_json: createSanitizedAttributionPayload({\n        traceId: attributionTraceId,\n        sourceUsed: resolvedAttribution.sourceUsed,\n        firstTouch: resolvedAttribution.firstTouch,\n        latestTouch: resolvedAttribution.latestTouch,\n        submittedTouch,\n      }),`,
    "sanitized snapshot raw payload"
  );

  source = replaceRequired(
    source,
    `  if (leadError || !lead) {\n    return rejectPublicSubmit(`,
    `  if (leadError || !lead) {\n    const { error: cleanupError } = await supabase\n      .from("lead_source_snapshots")\n      .delete()\n      .eq("id", snapshot.id);\n    if (cleanupError) {\n      console.warn("[LaunchHub] orphan_snapshot_cleanup_failed", {\n        attribution_trace_id: attributionTraceId,\n        snapshot_id: snapshot.id,\n        code: cleanupError.code,\n      });\n    }\n    return rejectPublicSubmit(`,
    "orphan snapshot cleanup"
  );

  source = replaceRequired(
    source,
    `         attribution_source_used: resolvedAttribution.sourceUsed,\n         proxy_cookie_present: resolvedAttribution.proxyCookiePresent,`,
    `         attribution_source_used: resolvedAttribution.sourceUsed,\n         attribution_trace_id: attributionTraceId,\n         proxy_cookie_present: resolvedAttribution.proxyCookiePresent,`,
    "lead event attribution trace"
  );

  source = replaceRequired(
    source,
    `      source_snapshot_id: snapshot.id,\n      source_type: classification.sourceType,`,
    `      source_snapshot_id: snapshot.id,\n      attribution_trace_id: attributionTraceId,\n      source_type: classification.sourceType,`,
    "API response attribution trace"
  );

  return source;
});

await patchFile("src/lib/data/businessMetrics.ts", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `  contentDisplayLabel,\n  preferredPageUrl,\n  sourceDisplayLabel,`,
    `  contentDisplayLabel,\n  hasTrackedAttribution,\n  preferredPageUrl,\n  sourceDisplayLabel,`,
    "business metrics tracked attribution import"
  );
  source = replaceRegexRequired(
    source,
    /export function isTrackable\(lead: LeadRow\) \{[\s\S]*?\n\}/,
    `export function isTrackable(lead: LeadRow) {\n  const snapshot = lead.sourceSnapshot;\n  const snapshotStatus = cleanAttributionText(snapshot?.tracking_status);\n  const snapshotTouch = sourceTouch(lead);\n\n  if (\n    [\n      "complete_utm",\n      "partial_utm",\n      "click_id_only",\n      "ctwa_detected",\n      "storage_recovered",\n    ].includes(snapshotStatus || "") ||\n    hasTrackedAttribution(snapshotTouch)\n  ) {\n    return true;\n  }\n\n  if (snapshot && ["organic_unknown", "missing"].includes(snapshotStatus || "")) {\n    return false;\n  }\n\n  return lead.source_type !== "organic_unknown";\n}`,
    "snapshot-first trackable mapping"
  );
  return source;
});

await patchFile("src/lib/crm/leadOps.ts", (input) =>
  replaceRequired(
    input,
    `    sourceTypeRaw: lead.source_type || lead.sourceSnapshot?.source_type || "unknown",`,
    `    // LAUNCHHUB_ATTRIBUTION_BRIDGE_V2: snapshot is the attribution source of truth.\n    sourceTypeRaw: lead.sourceSnapshot?.source_type || lead.source_type || "unknown",`,
    "CRM snapshot-first raw source"
  )
);

await patchFile("src/lib/data/brandOperations.ts", (input) => {
  let source = input;
  source = replaceRequired(
    source,
    `export function getFormOperations(config: ConfigurationData, form: FormSetting) {`,
    `export function buildWixAttributionBridgeCode(\n  htmlComponentId = "#html1"\n) {\n  const safeComponentId = JSON.stringify(htmlComponentId);\n  const keys = [\n    "utm_source",\n    "utm_medium",\n    "utm_campaign",\n    "utm_content",\n    "utm_term",\n    "fbclid",\n    "gclid",\n    "ctwa_id",\n    "campaign_id",\n    "adset_id",\n    "ad_id",\n    "placement",\n    "meta_campaign_id",\n    "meta_adset_id",\n    "meta_ad_id",\n  ];\n\n  return [\n    'import wixLocationFrontend from "wix-location-frontend";',\n    'import { local, session } from "wix-storage-frontend";',\n    "",\n    \`const HTML_COMPONENT_ID = \${safeComponentId};\`,\n    \`const ATTRIBUTION_KEYS = \${JSON.stringify(keys)};\`,\n    'const FIRST_TOUCH_KEY = "launchhub_wix_first_touch";',\n    'const LATEST_TOUCH_KEY = "launchhub_wix_latest_touch";',\n    "",\n    "function readJson(storage, key) {",\n    "  try {",\n    "    const value = storage.getItem(key);",\n    "    return value ? JSON.parse(value) : null;",\n    "  } catch (error) {",\n    "    return null;",\n    "  }",\n    "}",\n    "",\n    "function hasTracking(touch) {",\n    "  return Boolean(touch && ATTRIBUTION_KEYS.some((key) => touch[key]));",\n    "}",\n    "",\n    "function captureCurrentTouch() {",\n    "  const query = wixLocationFrontend.query || {};",\n    "  const pageUrl = wixLocationFrontend.url;",\n    "  const touch = {",\n    '    source_capture_method: "wix_page_code",',\n    '    attribution_source_used: "wix_parent_bridge",',\n    "    parent_url: pageUrl,",\n    "    current_page_url: pageUrl,",\n    "    landing_page_url: pageUrl,",\n    '    page_path: "/" + wixLocationFrontend.path.join("/"),',\n    "    captured_at: new Date().toISOString(),",\n    "  };",\n    "  try { touch.parent_origin = new URL(pageUrl).origin; } catch (error) {}",\n    "  ATTRIBUTION_KEYS.forEach((key) => {",\n    "    const value = query[key];",\n    '    if (typeof value === "string" && value.trim()) touch[key] = value.trim();',\n    "  });",\n    "  return touch;",\n    "}",\n    "",\n    "function buildEnvelope() {",\n    "  const current = captureCurrentTouch();",\n    "  const storedFirst = readJson(local, FIRST_TOUCH_KEY);",\n    "  const storedLatest = readJson(session, LATEST_TOUCH_KEY);",\n    "  const first = hasTracking(storedFirst) ? storedFirst : current;",\n    "  const latest = hasTracking(current) ? current : (storedLatest || current);",\n    "  if (!hasTracking(storedFirst) && hasTracking(current)) {",\n    "    local.setItem(FIRST_TOUCH_KEY, JSON.stringify(current));",\n    "  }",\n    "  if (hasTracking(latest)) {",\n    "    session.setItem(LATEST_TOUCH_KEY, JSON.stringify(latest));",\n    "  }",\n    "  return {",\n    "    first_touch_json: first,",\n    "    latest_touch_json: latest,",\n    "    submitted_touch_json: latest,",\n    "  };",\n    "}",\n    "",\n    "function sendAttribution() {",\n    "  $w(HTML_COMPONENT_ID).postMessage({",\n    '    type: "launchhub_attribution_payload",',\n    "    schema_version: 1,",\n    "    payload: buildEnvelope(),",\n    "  });",\n    "}",\n    "",\n    "$w.onReady(function () {",\n    "  const htmlComponent = $w(HTML_COMPONENT_ID);",\n    "  htmlComponent.onMessage((event) => {",\n    '    if (event.data?.type === "launchhub_wix_attribution_ready") {',\n    "      sendAttribution();",\n    "    }",\n    "  });",\n    "  sendAttribution();",\n    "  wixLocationFrontend.onChange(() => sendAttribution());",\n    "});",\n  ].join("\\n");\n}\n\n// LAUNCHHUB_ATTRIBUTION_BRIDGE_V2\nexport function getFormOperations(config: ConfigurationData, form: FormSetting) {`,
    "Wix page-code bridge generator"
  );
  source = replaceRequired(
    source,
    `    embedCode,\n    previewUrl:`,
    `    embedCode,\n    wixAttributionBridgeCode: buildWixAttributionBridgeCode(),\n    previewUrl:`,
    "Wix bridge code in form operations"
  );
  return source;
});

await patchFile("src/app/forms/[formId]/page.tsx", (input) =>
  replaceRequired(
    input,
    `            <EmbedCodeCard\n              code={ops.embedCode}\n              title="Ready-to-paste Wix embed"\n              description={\n                ops.conversionMode === "thank_you_redirect"\n                  ? "此 snippet 會在成功儲存 lead 後轉到已設定的 Thank You Page，由 Wix Thank You Page 觸發轉換。"\n                  : ops.pixelConfigured\n                  ? "此 snippet 已包含此品牌的 data-pixel-id，成功儲存 lead 後會發送 CompleteRegistration beacon。"\n                  : "此品牌未設定 Pixel，snippet 會省略 data-pixel-id。"\n              }\n            />`,
    `            <EmbedCodeCard\n              code={ops.embedCode}\n              title="Ready-to-paste Wix embed"\n              description={\n                ops.conversionMode === "thank_you_redirect"\n                  ? "此 snippet 會在成功儲存 lead 後轉到已設定的 Thank You Page，由 Wix Thank You Page 觸發轉換。"\n                  : ops.pixelConfigured\n                  ? "此 snippet 已包含此品牌的 data-pixel-id，成功儲存 lead 後會發送 CompleteRegistration beacon。"\n                  : "此品牌未設定 Pixel，snippet 會省略 data-pixel-id。"\n              }\n            />\n\n            <EmbedCodeCard\n              code={ops.wixAttributionBridgeCode}\n              title="Wix UTM Bridge（每個表格頁面設定一次）"\n              description="貼到 Wix Page Code，並將 #html1 改成該頁 HTML Embed 元件 ID。呢段 bridge 會將 Wix 頁面 UTM 安全傳入 LaunchHub 表格。"\n            />`,
    "Wix bridge code card"
  )
);

console.log("Prepared LaunchHub attribution bridge, server trace, and snapshot-first display.");
