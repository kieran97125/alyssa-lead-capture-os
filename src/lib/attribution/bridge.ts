import {
  LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
  hasPublicAttributionTracking,
  normalizePublicAttributionFields,
} from "@/lib/attribution/publicAttributionCookie";
import {
  cleanAttributionText,
  hasExplicitCtwaEvidence,
} from "@/lib/attribution/display";

export const ATTRIBUTION_BRIDGE_SCHEMA_VERSION = 1;

export const ATTRIBUTION_PAYLOAD_MESSAGE_TYPES = new Set([
  "alyssa_attribution_payload",
  "launchhub_attribution_payload",
]);

export const ATTRIBUTION_READY_MESSAGE_TYPES = [
  "alyssa_iframe_ready",
  "launchhub_iframe_ready",
] as const;

export type LaunchHubAttributionEnvelope = {
  first_touch_json?: Record<string, unknown>;
  latest_touch_json?: Record<string, unknown>;
  submitted_touch_json?: Record<string, unknown>;
  server_touch_json?: Record<string, unknown>;
  locked_touch_json?: Record<string, unknown>;
  locked_session_touch_json?: Record<string, unknown>;
  locked_local_touch_json?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTouch(value: unknown) {
  return isRecord(value)
    ? normalizePublicAttributionFields(value)
    : ({} as Record<string, unknown>);
}

function text(value: unknown) {
  return cleanAttributionText(value) || "";
}

/**
 * Scores acquisition evidence, deliberately treating _fbp/_fbc as supporting
 * browser identifiers rather than a marketing touch. This prevents a clean
 * follow-up URL with only browser cookies from replacing a real UTM first touch.
 */
export function attributionEvidenceScore(value: unknown) {
  const touch = normalizeTouch(value);
  if (hasExplicitCtwaEvidence(touch)) return 500;

  const utmCount = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
  ].filter((key) => text(touch[key])).length;
  if (utmCount >= 3) return 400 + utmCount;
  if (utmCount > 0) return 300 + utmCount;

  const clickIdCount = [
    "fbclid",
    "gclid",
    "ttclid",
    "msclkid",
    "wbraid",
    "gbraid",
  ].filter((key) => text(touch[key])).length;
  if (clickIdCount > 0) return 200 + clickIdCount;

  const campaignEvidenceCount = [
    text(touch.campaign_id) || text(touch.meta_campaign_id),
    text(touch.adset_id) || text(touch.meta_adset_id),
    text(touch.ad_id) || text(touch.meta_ad_id),
    text(touch.placement),
  ].filter(Boolean).length;
  if (campaignEvidenceCount > 0) return 150 + campaignEvidenceCount;

  if (text(touch.referrer) || text(touch.parent_url)) return 50;
  if (text(touch.fbp) || text(touch.fbc)) return 10;
  // Keep the scorer aligned with the public capture contract if a new
  // recognized tracking key is added before it receives a dedicated tier.
  if (hasPublicAttributionTracking(touch)) return 1;
  return 0;
}

function mergeTouch(
  baseValue: Record<string, unknown> | undefined,
  incomingValue: Record<string, unknown> | undefined
) {
  const base = normalizeTouch(baseValue);
  const incoming = normalizeTouch(incomingValue);
  const merged: Record<string, unknown> = { ...base };

  Object.entries(incoming).forEach(([key, value]) => {
    if (typeof value === "string") {
      const cleaned = value.trim();
      if (cleaned) merged[key] = cleaned;
      return;
    }

    if (value !== null && value !== undefined && typeof value !== "object") {
      merged[key] = value;
    }
  });

  return normalizePublicAttributionFields(merged);
}

export function normalizeAttributionEnvelope(
  value: unknown
): LaunchHubAttributionEnvelope {
  if (!isRecord(value)) return {};

  return {
    first_touch_json: normalizeTouch(value.first_touch_json),
    latest_touch_json: normalizeTouch(value.latest_touch_json),
    submitted_touch_json: normalizeTouch(value.submitted_touch_json),
    server_touch_json: normalizeTouch(value.server_touch_json),
    locked_touch_json: normalizeTouch(value.locked_touch_json),
    locked_session_touch_json: normalizeTouch(value.locked_session_touch_json),
    locked_local_touch_json: normalizeTouch(value.locked_local_touch_json),
  };
}

export function hasAttributionEnvelopeTracking(
  value: LaunchHubAttributionEnvelope | null | undefined
) {
  if (!value) return false;

  return [
    value.submitted_touch_json,
    value.latest_touch_json,
    value.first_touch_json,
    value.server_touch_json,
    value.locked_touch_json,
    value.locked_session_touch_json,
    value.locked_local_touch_json,
  ].some((touch) => hasPublicAttributionTracking(touch));
}

export function mergeAttributionEnvelopes(
  baseValue: LaunchHubAttributionEnvelope | null | undefined,
  incomingValue: LaunchHubAttributionEnvelope | null | undefined
): LaunchHubAttributionEnvelope {
  const base = normalizeAttributionEnvelope(baseValue);
  const incoming = normalizeAttributionEnvelope(incomingValue);
  const incomingFirst = normalizeTouch(incoming.first_touch_json);
  const baseFirst = normalizeTouch(base.first_touch_json);
  const baseFirstScore = attributionEvidenceScore(baseFirst);
  const incomingFirstScore = attributionEvidenceScore(incomingFirst);
  const firstTouch =
    baseFirstScore > 0 && baseFirstScore >= incomingFirstScore
      ? baseFirst
      : incomingFirstScore > 0
        ? incomingFirst
        : baseFirst;
  const latestTouch = mergeTouch(
    base.latest_touch_json,
    incoming.latest_touch_json
  );
  const submittedTouch = mergeTouch(
    mergeTouch(base.submitted_touch_json, base.latest_touch_json),
    mergeTouch(incoming.latest_touch_json, incoming.submitted_touch_json)
  );
  const lockedCandidates = [
    normalizeTouch(base.locked_touch_json),
    baseFirst,
    normalizeTouch(incoming.locked_touch_json),
    incomingFirst,
  ];
  const lockedTouch = lockedCandidates.reduce<Record<string, unknown>>(
    (best, candidate) =>
      attributionEvidenceScore(candidate) > attributionEvidenceScore(best)
        ? candidate
        : best,
    {}
  );

  return {
    first_touch_json: firstTouch,
    latest_touch_json: latestTouch,
    submitted_touch_json: submittedTouch,
    server_touch_json: mergeTouch(
      base.server_touch_json,
      incoming.server_touch_json
    ),
    locked_touch_json: lockedTouch,
    locked_session_touch_json: mergeTouch(
      base.locked_session_touch_json,
      incoming.locked_session_touch_json
    ),
    locked_local_touch_json: mergeTouch(
      base.locked_local_touch_json,
      incoming.locked_local_touch_json
    ),
  };
}

function writeStorage(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in privacy modes. Submission still uses memory.
  }
}

function readStorageTouch(storage: Storage, key: string) {
  try {
    const raw = storage.getItem(key);
    return raw ? normalizeTouch(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function persistAttributionEnvelope(
  envelopeValue: LaunchHubAttributionEnvelope
) {
  if (typeof window === "undefined") return;
  const envelope = normalizeAttributionEnvelope(envelopeValue);
  const first = normalizeTouch(envelope.first_touch_json);
  const latest = normalizeTouch(envelope.latest_touch_json);
  const submitted = normalizeTouch(envelope.submitted_touch_json);
  const lockedCandidates = [
    readStorageTouch(
      window.localStorage,
      LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY
    ),
    readStorageTouch(
      window.sessionStorage,
      LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY
    ),
    first,
    latest,
    submitted,
    normalizeTouch(envelope.locked_touch_json),
  ];
  const locked = lockedCandidates.reduce<Record<string, unknown>>(
    (best, candidate) =>
      attributionEvidenceScore(candidate) > attributionEvidenceScore(best)
        ? candidate
        : best,
    {}
  );

  if (attributionEvidenceScore(first) > 0) {
    const existingRaw = window.localStorage.getItem("alyssa_first_touch");
    let existing: Record<string, unknown> = {};
    try {
      existing = existingRaw ? normalizeTouch(JSON.parse(existingRaw)) : {};
    } catch {
      existing = {};
    }
    if (
      attributionEvidenceScore(first) > attributionEvidenceScore(existing)
    ) {
      writeStorage(window.localStorage, "alyssa_first_touch", first);
    }
  }

  if (hasPublicAttributionTracking(latest)) {
    writeStorage(window.sessionStorage, "alyssa_latest_touch", latest);
  }

  if (attributionEvidenceScore(locked) > 0) {
    writeStorage(
      window.sessionStorage,
      LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
      locked
    );
    writeStorage(
      window.localStorage,
      LOCKED_PUBLIC_ATTRIBUTION_STORAGE_KEY,
      locked
    );
  }
}

export function attributionMessageHasSupportedSchema(value: unknown) {
  if (!isRecord(value)) return false;
  const schemaVersion = value.schema_version;
  return (
    schemaVersion === undefined ||
    schemaVersion === ATTRIBUTION_BRIDGE_SCHEMA_VERSION
  );
}
