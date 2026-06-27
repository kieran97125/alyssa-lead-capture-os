# CRM Phase 2.4 Tracking Capture Improvement Plan

Status: planning only. No live tracking behavior changed. No Meta events are sent. No database migration has been applied.

## Goal

Improve the future readiness of LaunchHub and CRM attribution data for Meta CAPI / offline conversion matching, while keeping the existing public lead capture flow, Wix embed behavior, thank-you redirect, Google Sheets sync, and consent behavior stable.

This plan is intentionally additive. Existing lead submit payloads, form tokens, UTM/lh attribution, Pixel behavior, and CRM reports should keep working exactly as they do now.

## Current Capture Flow

1. Public visitor arrives on a LaunchHub landing page or a Wix page with an embedded LaunchHub form.
2. Public LP, proxy attribution cookie, and Wix embed script preserve safe tracking parameters where available:
   - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
   - `lh_source`, `lh_medium`, `lh_campaign`, `lh_content`, `lh_term`
   - `fbclid`, `gclid`, `wbraid`, `gbraid`
   - `campaign_id`, `adset_id`, `ad_id`, `placement`
   - `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`
   - `parent_url`, `parent_origin`
3. `PublicLeadForm` builds the lead submission payload from the live URL, preserved attribution state, iframe query parameters, and form context.
4. `/api/public/leads` merges attribution from submitted body tracking, preserved first/latest body tracking, proxy attribution cookie, and direct/no tracking fallback.
5. `/api/public/leads` classifies the final attribution touch and inserts a `lead_source_snapshots` record.
6. CRM reporting and outcome preview use existing lead, CRM case, booking, interaction, and source snapshot data. They do not send data externally.

## Currently Stored Fields

The existing source snapshot model already supports the core reporting path:

- UTM source, medium, campaign, content, term
- `fbclid`
- `gclid`
- `wbraid`
- `gbraid`
- `current_page_url`
- `landing_page_url`
- `page_path`
- CTWA / WhatsApp IDs where available
- Meta campaign, ad set, and ad IDs where available
- `tracking_status`
- `audit_reason`

Lead/form relationship is also available through existing lead/form references, and CRM rows can derive operational status from `crm_lead_cases`.

## Missing Or Weak Fields

The current model is good enough for operational reporting, but not yet complete for future platform feedback matching.

Important gaps:

- `fbp` is not reliably captured or stored.
- `fbc` is not reliably captured or stored.
- `parent_url` is passed in some embed flows but is not a first-class snapshot field.
- `parent_origin` is passed in some embed flows but is not a first-class snapshot field.
- `referrer` is not stored as a stable source snapshot field.
- `landing_page_slug` is not consistently stored as a first-class field.
- `form_token` is not consistently stored directly on the source snapshot.
- Raw safe attribution context is not stored in a durable `source_snapshot_json`.
- No `client_event_id` is prepared for future deduplication.
- No explicit capture version is stored to separate legacy tracking from future enhanced capture.

UTM data is useful for reporting, but future Meta CAPI matching generally needs stronger identifiers such as `fbc`, `fbp`, `fbclid`, and a reliable event identity strategy.

## Recommended Future Fields

Recommended additive fields for source snapshot capture:

- `fbclid`
- `fbp`
- `fbc`
- `page_url`
- `parent_url`
- `parent_origin`
- `referrer`
- `landing_page_slug`
- `form_token`
- `form_id`
- `meta_campaign_id`
- `meta_adset_id`
- `meta_ad_id`
- `source_snapshot_json`
- `client_event_id`
- `tracking_capture_version`
- `captured_at`

`page_url` can map to the current public page URL used at submission time. Existing `current_page_url` and `landing_page_url` should remain unchanged until a reviewed migration and data-access update chooses a single canonical naming pattern.

## Where To Store Safely

Preferred storage:

1. Keep existing reporting fields on `lead_source_snapshots`.
2. Add nullable columns to `lead_source_snapshots` for high-value identifiers such as `fbp`, `fbc`, `parent_url`, `referrer`, `landing_page_slug`, and `form_token`.
3. Add `source_snapshot_json jsonb` for the full safe attribution context.
4. Keep CRM outcome/event preview rows reading from `lead_source_snapshots`, not from live browser state.

Do not store customer name, phone, email, appointment details, notes, or free text in `source_snapshot_json`. It should only contain safe attribution and page context.

## Existing Table Support

The existing model already supports:

- UTM reporting
- click ID reporting for `fbclid`, `gclid`, `wbraid`, `gbraid`
- page URL audit
- source status and audit reason
- Meta campaign/adset/ad ID where supplied

The existing model does not reliably support:

- `fbp`
- `fbc`
- complete parent/referrer context
- stable client event IDs for later deduplication
- versioned capture diagnostics

Because `lead_source_snapshots` is already the audit boundary for attribution, it is the safest place to extend future capture. A separate event queue should later read from it, rather than introducing tracking behavior directly into CRM write actions.

## Future SQL Migration

A reviewed SQL proposal is included separately:

- `docs/CRM_PHASE_2_4_TRACKING_CAPTURE_FIELDS_PLAN.sql`

That file is proposal-only and wrapped in `begin; ... rollback;`. It must not be executed until reviewed and explicitly approved.

## Wix Embed Safety

Future capture changes must not break Wix embeds.

Rules for implementation:

- Keep all current query parameter names working.
- Do not rename `utm_*`, `lh_*`, click ID, or Meta ID fields.
- Do not require new fields for a successful lead submit.
- Do not delay form rendering or submission while tracking fields are read.
- Preserve `parent_url` and `parent_origin` behavior for Wix `filesusr.com` nested iframe contexts.
- Do not send PII through postMessage.
- Add debug logging only behind an explicit debug flag.

## Thank-you Redirect Safety

The `thank_you_redirect` mode must remain conversion-safe:

- Lead save remains the source of truth.
- Redirect still happens after successful lead save.
- Future capture of `fbp`, `fbc`, or `client_event_id` must not block redirect.
- CompleteRegistration behavior remains owned by the existing thank-you flow until a separate reviewed change is made.

## Google Sheets Safety

Google Sheets is for CS follow-up, not raw attribution analysis.

Future tracking capture should not add raw technical columns to the CS sheet by default. If marketing attribution columns are later needed, they should be appended to the far right in a separate reviewed request.

## Consent Boundary

This plan is for operational attribution and future platform matching readiness. It does not add direct marketing consent.

Privacy rules:

- Keep consent checkbox behavior unchanged.
- Do not store PII in tracking JSON.
- Do not send events externally in this phase.
- Review public legal wording before any future platform feedback sending.
- Treat CAPI/offline feedback as a separate reviewed phase with clear consent and platform policy checks.

## How This Improves Future CAPI Matching

Future Meta matching quality improves when LaunchHub can preserve:

- `fbc` created from `fbclid`
- `_fbp` browser identifier where available
- full page/referrer context
- Meta campaign/adset/ad IDs
- stable `client_event_id` for deduplication
- CRM operational outcome time

UTM alone is useful for management reporting, but usually not enough for strong platform matching. This plan prepares the storage layer so later Meta CAPI/offline conversion work can be built as an auditable queue without changing public lead capture semantics.
