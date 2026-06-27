begin;

-- CRM Phase 3.0 Editable Settings Plan
-- Proposal only. Do not execute without review and explicit approval.
--
-- Goal:
-- Provide a future auditable, brand-aware settings layer for CRM operational
-- options while preserving safe code defaults from src/lib/crm/settingsConfig.ts.
--
-- This proposal must not change public lead submission, Google Sheets sync,
-- Pixel / CompleteRegistration, thank_you_redirect, consent, form tokens,
-- manual WhatsApp open behavior, Wix embed tracking, WhatsApp API behavior,
-- Meta API behavior, or any booking status semantics.

create table if not exists public.crm_app_settings (
  id uuid primary key default gen_random_uuid(),

  -- Scope:
  -- null brand_id / brand_slug means global fallback.
  -- brand_id should be preferred when available; brand_slug helps import/export
  -- and admin readability.
  brand_id uuid null references public.brands(id) on delete cascade,
  brand_slug text null,

  -- Examples:
  -- crm_status_labels, lost_reasons, invalid_reasons, contact_channels,
  -- follow_up_outcomes, quick_replies, ai_reply_drafts, ai_reply_tone,
  -- booking_confirmation_templates, treatment_faq_replies, room_options,
  -- paid_status_labels.
  config_group text not null,
  config_key text not null,

  label text not null,
  description text null,
  value_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,

  -- Audit / lifecycle:
  version integer not null default 1,
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Soft governance:
  locked boolean not null default false,
  internal_note text null,

  constraint crm_app_settings_scope_key_unique unique (
    brand_id,
    brand_slug,
    config_group,
    config_key
  ),
  constraint crm_app_settings_group_key_not_blank check (
    length(trim(config_group)) > 0
    and length(trim(config_key)) > 0
    and length(trim(label)) > 0
  ),
  constraint crm_app_settings_value_is_object check (
    jsonb_typeof(value_json) = 'object'
  )
);

create index if not exists crm_app_settings_group_idx
  on public.crm_app_settings(config_group, enabled, sort_order);

create index if not exists crm_app_settings_brand_id_idx
  on public.crm_app_settings(brand_id, config_group, enabled, sort_order)
  where brand_id is not null;

create index if not exists crm_app_settings_brand_slug_idx
  on public.crm_app_settings(brand_slug, config_group, enabled, sort_order)
  where brand_slug is not null;

create index if not exists crm_app_settings_updated_at_idx
  on public.crm_app_settings(updated_at desc);

comment on table public.crm_app_settings is
  'Future CRM operational settings. Proposal only until reviewed and applied.';

comment on column public.crm_app_settings.value_json is
  'Structured operational value. Store labels, template body, metadata, and validation hints only; do not store customer PII or secrets.';

comment on column public.crm_app_settings.locked is
  'When true, future admin UI should prevent editing because this setting is system-critical.';

-- Suggested future trigger, not applied here:
--
-- create or replace function public.set_crm_app_settings_updated_at()
-- returns trigger language plpgsql as $$
-- begin
--   new.updated_at = now();
--   new.version = coalesce(old.version, 0) + 1;
--   return new;
-- end;
-- $$;
--
-- create trigger crm_app_settings_set_updated_at
-- before update on public.crm_app_settings
-- for each row execute function public.set_crm_app_settings_updated_at();

-- Example future seed shape. Keep as comments until reviewed:
--
-- insert into public.crm_app_settings
--   (brand_slug, config_group, config_key, label, description, value_json, sort_order)
-- values
--   (
--     null,
--     'quick_replies',
--     'first_follow_up',
--     '首次跟進',
--     'New lead first WhatsApp follow-up draft.',
--     '{"body":"你好，我哋收到你嘅登記，想同你確認預約資料同方便時間。","recommended_statuses":["new","contacting"]}',
--     10
--   ),
--   (
--     null,
--     'lost_reasons',
--     'price_concern',
--     '價錢考慮',
--     'Customer indicates price concern.',
--     '{"value":"price_concern"}',
--     20
--   )
-- on conflict do nothing;

rollback;
