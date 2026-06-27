export const sourceTypes = [
  "reg_form_utm",
  "whatsapp_ctwa",
  "organic_unknown",
  "manual",
  "imported",
] as const;

export const trackingStatuses = [
  "complete_utm",
  "partial_utm",
  "click_id_only",
  "ctwa_detected",
  "referrer_only",
  "storage_recovered",
  "organic_unknown",
  "missing",
] as const;

export const leadEventTypes = [
  "page_view",
  "parent_attribution_captured",
  "form_iframe_loaded",
  "attribution_payload_received",
  "form_view",
  "form_start",
  "form_submit_attempt",
  "form_submit_success",
  "form_submit_failed",
  "whatsapp_clicked",
  "whatsapp_inbound_received",
  "ctwa_source_detected",
  "organic_source_assigned",
  "booking_created",
  "booking_confirmed",
  "booking_rescheduled",
  "booking_cancelled",
  "payment_initiated",
  "payment_success",
  "payment_failed",
  "payment_cancelled",
  "thank_you_viewed",
  "crm_followup_started",
  "crm_followup_updated",
  "show_up",
  "no_show",
  "deal_paid",
  "deal_lost",
  "duplicate_detected",
] as const;

export type SourceType = (typeof sourceTypes)[number];
export type TrackingStatus = (typeof trackingStatuses)[number];
export type LeadEventType = (typeof leadEventTypes)[number];

export type TouchPayload = {
  source_capture_method?: string | null;
  visitor_id?: string | null;
  session_id?: string | null;
  parent_origin?: string | null;
  storage_status?: string | null;
  landing_page_url?: string | null;
  current_page_url?: string | null;
  page_url?: string | null;
  page_path?: string | null;
  page_title?: string | null;
  referrer?: string | null;
  parent_url?: string | null;
  form_token?: string | null;
  form_id?: string | null;
  landing_page_slug?: string | null;
  client_event_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_id?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  msclkid?: string | null;
  wbraid?: string | null;
  gbraid?: string | null;
  campaign_id?: string | null;
  adset_id?: string | null;
  ad_id?: string | null;
  ctwa_id?: string | null;
  ctwa_clid?: string | null;
  whatsapp_message_id?: string | null;
  whatsapp_conversation_id?: string | null;
  whatsapp_phone_number_id?: string | null;
  meta_ad_id?: string | null;
  meta_adset_id?: string | null;
  meta_campaign_id?: string | null;
  placement?: string | null;
  meta_source_url?: string | null;
  lh_source?: string | null;
  lh_medium?: string | null;
  lh_campaign?: string | null;
  lh_content?: string | null;
  lh_term?: string | null;
  lh_campaign_id?: string | null;
  lh_adset_id?: string | null;
  lh_ad_id?: string | null;
  lh_placement?: string | null;
  lh_channel?: string | null;
  lh_brand?: string | null;
  whatsapp_referral_headline?: string | null;
  whatsapp_referral_body?: string | null;
  whatsapp_referral_source_type?: string | null;
  whatsapp_referral_source_id?: string | null;
  raw_payload_json?: unknown;
};

export type AttributionClassification = {
  sourceType: SourceType;
  attributionQuality: TrackingStatus;
  trackingStatus: TrackingStatus;
  auditReason: string;
};
