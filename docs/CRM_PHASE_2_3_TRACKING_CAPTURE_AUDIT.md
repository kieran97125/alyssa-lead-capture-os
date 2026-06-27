# CRM Phase 2.3 Tracking Capture Audit

This is an audit note only. It does not change public lead submission, Wix embed tracking, Pixel behavior, Google Sheets sync, CRM writes, or database schema.

## Current Capture Coverage

LaunchHub currently captures and reports these fields through the lead/source snapshot path where available:

- UTM fields: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- Click IDs: `fbclid`, `gclid`, `wbraid`, `gbraid`
- Meta identifiers: `meta_campaign_id`, `meta_adset_id`, `meta_ad_id`
- Page context: `current_page_url`, `landing_page_url`, `page_path`
- WhatsApp / CTWA fields: `ctwa_id`, `whatsapp_phone_number_id`, `whatsapp_referral_source_id`, referral headline/body, source URL
- Form context: `form_id` and public form token through the linked form record

These fields are enough for operational reporting and source quality overview.

## Missing Or Not Yet Reliable

The current typed CRM/reporting model does not reliably expose:

- `fbp`
- `fbc`
- a fixed `parent_url` field for Wix top-level page context
- a durable event queue with event deduplication and send status
- a reviewed hashed user-data readiness record for future CAPI matching

`fbclid` is useful, but future Meta CAPI matching is stronger when `fbc` / `fbp` and hashed user data are prepared correctly.

## Recommended Future Capture Fields

Future source snapshot or event-readiness storage should consider:

- `fbp`
- `fbc`
- `parent_url`
- `parent_origin`
- `landing_page_slug`
- `form_token`
- `tracking_capture_version`
- `client_event_id` or equivalent dedupe key
- hashed user-data readiness metadata, without storing raw PII in event queues

If schema is needed later, create a reviewed SQL proposal such as:

`docs/CRM_PHASE_2_4_TRACKING_CAPTURE_FIELDS_PLAN.sql`

Do not apply live schema changes without review.

## Storage Guidance

The safest long-term approach is:

- Keep raw lead submission behavior unchanged.
- Preserve source capture data in `lead_source_snapshots` or a dedicated tracking snapshot table.
- Keep future outbound event queue payloads separate from mutable CRM case status.
- Store only safe payload previews and hashes in event queue rows.
- Avoid raw phone, raw email, name, notes, or appointment free text in any future platform-send queue.

## Wix / Public Form Safety

Future tracking improvements must not break:

- Wix iframe embed behavior
- `lh_*` passthrough
- UTM preservation
- `fbclid` preservation
- thank-you redirect flow
- existing Pixel / CompleteRegistration behavior
- Google Sheets CS sync

Any new tracking capture should be additive and backward compatible.

## Why This Matters

UTM fields are helpful for management reporting, but they do not prove a user can be matched by Meta. For future Meta CAPI or offline conversion feedback, stronger identifiers such as `fbclid`, `fbc`, `fbp`, and properly prepared hashed user data are important. Direct / no tracking leads should remain CRM-reporting-only unless future capture improves.
