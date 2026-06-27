-- CRM Phase 2.2 Outcome Event Queue Plan
-- Review-only SQL proposal. Do not execute until approved.
--
-- Purpose:
-- Design a durable, auditable queue for future CRM outcome feedback to Meta CAPI,
-- offline conversions, or other ad platforms.
--
-- Current safety boundary:
-- - Phase 2.1 is preview/audit only.
-- - No external events are sent.
-- - No Meta API calls are made.
-- - No live schema change has been applied.
-- - CRM operational statuses remain the source of truth.
--
-- Future queue goals:
-- - Deduplicate events before any platform send.
-- - Preserve CRM case, lead, brand, booking, and source context.
-- - Store payload preview separately from platform response audit.
-- - Track hashed user data readiness without exposing raw PII in send workers.
-- - Snapshot tracking identifiers at queue time so later edits do not change audit history.
-- - Support draft / ready / sent / failed / skipped lifecycle.
-- - Support retry and last-error visibility for CS / marketing audit.

begin;

create table if not exists crm_outcome_event_queue (
  id uuid primary key default gen_random_uuid(),

  -- CRM and LaunchHub references.
  case_id uuid not null references crm_lead_cases(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  source_lead_id uuid,
  booking_id uuid references crm_bookings(id) on delete set null,
  brand_id uuid,
  brand_slug text,

  -- Event identity and deduplication.
  platform text not null default 'meta',
  platform_account_id text,
  event_name text not null,
  outcome_type text not null,
  event_time timestamptz not null,
  event_id text not null,
  event_dedupe_key text not null,
  idempotency_key text not null,

  -- Future event-name mapping audit.
  event_mapping_version text not null default 'crm_phase_2_2_plan_v1',
  mapped_from_status text not null,
  mapped_from_action text,

  -- Readiness and send lifecycle.
  readiness_status text not null default 'review_required',
  send_status text not null default 'draft',
  tracking_quality text not null default 'unknown',
  hashed_user_data_status text not null default 'not_ready',
  ready_for_platform_feedback boolean not null default false,

  -- Source and tracking snapshot at queue time.
  source_type text,
  source_label text,
  campaign_label text,
  content_label text,
  page_url text,
  landing_page_slug text,
  fbclid text,
  fbc text,
  fbp text,
  gclid text,
  wbraid text,
  gbraid text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  placement text,
  ctwa_id text,
  whatsapp_referral_source_id text,

  -- Hash readiness and preview metadata.
  has_normalized_phone boolean not null default false,
  has_email boolean not null default false,
  has_fbc_or_fbclid boolean not null default false,
  has_fbp boolean not null default false,
  hashed_user_data_preview_json jsonb not null default '{}'::jsonb,

  -- Payload preview should be safe to inspect internally.
  -- Do not store raw phone, raw email, name, appointment notes, or free-text notes here.
  payload_preview_json jsonb not null default '{}'::jsonb,
  payload_hash text,

  -- External response audit for future send workers.
  external_event_id text,
  external_response_json jsonb not null default '{}'::jsonb,
  last_error_code text,
  last_error_message text,
  retry_count integer not null default 0,
  max_retry_count integer not null default 3,
  last_attempted_at timestamptz,
  next_retry_at timestamptz,
  sent_at timestamptz,
  skipped_at timestamptz,
  skipped_reason text,

  -- Human review / governance.
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_outcome_event_queue_platform_check
    check (platform in ('meta', 'google', 'offline_import', 'other')),
  constraint crm_outcome_event_queue_outcome_check
    check (outcome_type in ('booked', 'showed', 'no_show', 'lost', 'invalid')),
  constraint crm_outcome_event_queue_readiness_check
    check (
      readiness_status in (
        'ready',
        'needs_stronger_tracking',
        'crm_only',
        'missing_identifiers',
        'review_required'
      )
    ),
  constraint crm_outcome_event_queue_send_status_check
    check (send_status in ('draft', 'ready', 'sent', 'failed', 'skipped')),
  constraint crm_outcome_event_queue_tracking_quality_check
    check (tracking_quality in ('strong', 'partial', 'direct', 'missing', 'unknown')),
  constraint crm_outcome_event_queue_hash_status_check
    check (hashed_user_data_status in ('ready', 'partial', 'not_ready', 'not_applicable')),
  constraint crm_outcome_event_queue_retry_count_check
    check (retry_count >= 0 and max_retry_count >= 0),
  constraint crm_outcome_event_queue_unique_event_id
    unique (platform, event_id),
  constraint crm_outcome_event_queue_unique_dedupe_key
    unique (platform, event_dedupe_key),
  constraint crm_outcome_event_queue_unique_idempotency
    unique (platform, idempotency_key)
);

create index if not exists crm_outcome_event_queue_case_id_idx
  on crm_outcome_event_queue(case_id);

create index if not exists crm_outcome_event_queue_source_lead_id_idx
  on crm_outcome_event_queue(source_lead_id);

create index if not exists crm_outcome_event_queue_brand_idx
  on crm_outcome_event_queue(brand_slug, brand_id);

create index if not exists crm_outcome_event_queue_send_queue_idx
  on crm_outcome_event_queue(send_status, readiness_status, next_retry_at, created_at desc);

create index if not exists crm_outcome_event_queue_outcome_idx
  on crm_outcome_event_queue(outcome_type, event_time desc);

create index if not exists crm_outcome_event_queue_tracking_idx
  on crm_outcome_event_queue(tracking_quality, hashed_user_data_status);

create index if not exists crm_outcome_event_queue_meta_ids_idx
  on crm_outcome_event_queue(meta_campaign_id, meta_adset_id, meta_ad_id);

comment on table crm_outcome_event_queue is
  'Review-only proposal for a future CRM outcome feedback queue. Not executed or used by Phase 2.1.';

comment on column crm_outcome_event_queue.event_dedupe_key is
  'Future deterministic key, e.g. platform + case_id/source_lead_id + outcome_type + event_time bucket.';

comment on column crm_outcome_event_queue.payload_preview_json is
  'Safe internal preview payload. Must not include raw PII or free-text notes.';

comment on column crm_outcome_event_queue.hashed_user_data_preview_json is
  'Future hashed user-data readiness preview. Store hashes/status only, not raw phone/email/name.';

comment on column crm_outcome_event_queue.external_response_json is
  'Future platform response audit. Empty until live send workers are explicitly approved.';

rollback;
