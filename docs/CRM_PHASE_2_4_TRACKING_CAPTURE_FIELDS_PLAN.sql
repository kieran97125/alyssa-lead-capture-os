begin;

-- CRM Phase 2.4 Tracking Capture Fields Plan
-- Proposal only. Do not execute without review and explicit approval.
--
-- Goal:
-- Add optional attribution fields needed for future Meta CAPI / offline
-- conversion matching readiness. This proposal must not change current public
-- lead submission behavior, Wix embed behavior, Google Sheets sync, Pixel
-- behavior, thank_you_redirect, consent, or CRM write semantics.
--
-- Privacy boundary:
-- source_snapshot_json must contain safe attribution/page context only.
-- Do not store customer name, phone, email, appointment details, notes, lead ID
-- free text, or other PII inside source_snapshot_json.

-- 1) Add nullable fields to the existing attribution audit table.
-- These are additive and should be safe for existing records.
alter table lead_source_snapshots
  add column if not exists fbp text,
  add column if not exists fbc text,
  add column if not exists parent_url text,
  add column if not exists parent_origin text,
  add column if not exists referrer text,
  add column if not exists landing_page_slug text,
  add column if not exists form_token text,
  add column if not exists form_id uuid,
  add column if not exists source_snapshot_json jsonb not null default '{}'::jsonb,
  add column if not exists client_event_id text,
  add column if not exists tracking_capture_version text not null default 'v1',
  add column if not exists captured_at timestamptz not null default now();

-- 2) Optional indexes for future reporting and event queue preparation.
-- Confirm table size and query plans before applying in production.
create index if not exists lead_source_snapshots_fbc_idx
  on lead_source_snapshots (fbc)
  where fbc is not null;

create index if not exists lead_source_snapshots_fbp_idx
  on lead_source_snapshots (fbp)
  where fbp is not null;

create index if not exists lead_source_snapshots_fbclid_idx
  on lead_source_snapshots (fbclid)
  where fbclid is not null;

create index if not exists lead_source_snapshots_meta_ids_idx
  on lead_source_snapshots (meta_campaign_id, meta_adset_id, meta_ad_id)
  where meta_campaign_id is not null
     or meta_adset_id is not null
     or meta_ad_id is not null;

create index if not exists lead_source_snapshots_client_event_id_idx
  on lead_source_snapshots (client_event_id)
  where client_event_id is not null;

create index if not exists lead_source_snapshots_landing_page_slug_idx
  on lead_source_snapshots (landing_page_slug)
  where landing_page_slug is not null;

create index if not exists lead_source_snapshots_form_token_idx
  on lead_source_snapshots (form_token)
  where form_token is not null;

-- 3) Documentation comments for reviewers and future maintainers.
comment on column lead_source_snapshots.fbp is
  'Meta _fbp browser identifier when safely captured. Planning field only until live capture is reviewed.';

comment on column lead_source_snapshots.fbc is
  'Meta _fbc click identifier or derived fbc when safely captured. Planning field only until live capture is reviewed.';

comment on column lead_source_snapshots.parent_url is
  'Top-level parent page URL for embeds, especially Wix pages. Must not contain PII.';

comment on column lead_source_snapshots.referrer is
  'Browser referrer captured for attribution audit. Must not contain PII.';

comment on column lead_source_snapshots.source_snapshot_json is
  'Safe raw attribution snapshot for audit and future event queue preparation. No PII.';

comment on column lead_source_snapshots.client_event_id is
  'Future client-side event identifier for deduplication with platform events.';

comment on column lead_source_snapshots.tracking_capture_version is
  'Version marker for attribution capture behavior.';

-- Review queries that can be run after a future approved migration:
--
-- select
--   count(*) as total_snapshots,
--   count(*) filter (where fbclid is not null) as with_fbclid,
--   count(*) filter (where fbp is not null) as with_fbp,
--   count(*) filter (where fbc is not null) as with_fbc,
--   count(*) filter (where source_snapshot_json <> '{}'::jsonb) as with_json_snapshot
-- from lead_source_snapshots;

rollback;
