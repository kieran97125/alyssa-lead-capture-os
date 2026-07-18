import type { AttributionClassification, TouchPayload } from "./types";
import { cleanAttributionText, hasExplicitCtwaEvidence } from "./display";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_id",
  "utm_content",
  "utm_term",
] as const;

const CLICK_ID_KEYS = [
  "fbclid",
  "gclid",
  "ttclid",
  "msclkid",
  "wbraid",
  "gbraid",
] as const;

const META_ID_KEYS = [
  "campaign_id",
  "adset_id",
  "ad_id",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
] as const;

function present(value: unknown) {
  return Boolean(cleanAttributionText(value));
}

export function createAttributionTraceSummary({
  traceId,
  sourceUsed,
  touch,
  classification,
}: {
  traceId: string;
  sourceUsed: string;
  touch: TouchPayload;
  classification: AttributionClassification;
}) {
  return {
    attribution_trace_id: traceId,
    attribution_source_used: sourceUsed,
    tracking_status: classification.trackingStatus,
    source_type: classification.sourceType,
    audit_reason: classification.auditReason,
    utm_field_count: UTM_KEYS.filter((key) => present(touch[key])).length,
    click_id_present: CLICK_ID_KEYS.some((key) => present(touch[key])),
    meta_id_present: META_ID_KEYS.some((key) => present(touch[key])),
    ctwa_present: hasExplicitCtwaEvidence(touch),
    parent_payload_present: present(touch.parent_origin) || present(touch.parent_url),
    storage_status: cleanAttributionText(touch.storage_status, 80) || null,
    capture_method: cleanAttributionText(touch.source_capture_method, 120) || null,
  };
}

export function createSanitizedAttributionPayload({
  traceId,
  sourceUsed,
  firstTouch,
  latestTouch,
  submittedTouch,
}: {
  traceId: string;
  sourceUsed: string;
  firstTouch: TouchPayload;
  latestTouch: TouchPayload;
  submittedTouch: TouchPayload;
}) {
  return {
    attribution_trace_id: traceId,
    attribution_source_used: sourceUsed,
    first_touch_json: firstTouch,
    latest_touch_json: latestTouch,
    submitted_touch_json: submittedTouch,
  };
}
