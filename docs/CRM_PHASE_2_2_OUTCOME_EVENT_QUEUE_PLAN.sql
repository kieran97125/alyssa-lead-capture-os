-- CRM Phase 2.2 Outcome Event Queue Plan
-- Review-only SQL proposal. Do not execute until approved.
--
-- Purpose:
-- Prepare a durable queue for future CRM outcome feedback to Meta CAPI,
-- offline conversions, or other ad platforms.
--
-- Current Phase 2.1 is preview/audit only:
-- - No external events are sent.
-- - No Meta API calls are made.
-- - CRM operational statuses remain the source of truth.
--
-- Why a future queue is needed:
-- - Prevent duplicate external event sends.
-- - Store event readiness and send status.
-- - Keep payload audit metadata separate from CRM case state.
-- - Track retries, failures, and platform response IDs.
-- - Support review/approval before enabling any live feedback.

begin;

create table if not exists crm_outcome_event_queue (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references crm_lead_cases(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete set null,
  source_lead_id uuid,
  booking_id uuid references crm_bookings(id) on delete set null,

  platform text not null default 'meta',
  event_name text not null,
  outcome_type text not null,
  event_time timestamptz not null,
  event_id text not null,

  readiness_status text not null default 'review_required',
  send_status text not null default 'not_sent',
  tracking_quality text not null default 'unknown',

  fbclid text,
  fbc text,
  fbp text,
  meta_campaign_id text,
  meta_adset_id text,
  meta_ad_id text,
  source_label text,
  campaign_label text,

  payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  error_message text,
  attempt_count integer not null default 0,
  last_attempted_at timestamptz,
  sent_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_outcome_event_queue_platform_check
    check (platform in ('meta', 'google', 'offline_import', 'other')),
  constraint crm_outcome_event_queue_outcome_check
    check (outcome_type in ('booked', 'showed', 'no_show', 'lost', 'invalid')),
  constraint crm_outcome_event_queue_readiness_check
    check (readiness_status in ('ready', 'needs_stronger_tracking', 'crm_only', 'missing_identifiers', 'review_required')),
  constraint crm_outcome_event_queue_send_status_check
    check (send_status in ('not_sent', 'queued', 'sending', 'sent', 'failed', 'skipped')),
  constraint crm_outcome_event_queue_event_unique
    unique (platform, event_id)
);

create index if not exists crm_outcome_event_queue_case_id_idx
  on crm_outcome_event_queue(case_id);

create index if not exists crm_outcome_event_queue_send_status_idx
  on crm_outcome_event_queue(send_status, readiness_status, created_at desc);

create index if not exists crm_outcome_event_queue_outcome_idx
  on crm_outcome_event_queue(outcome_type, event_time desc);

comment on table crm_outcome_event_queue is
  'Review-only proposal for future CRM outcome feedback event queue. Not used by Phase 2.1.';

rollback;
