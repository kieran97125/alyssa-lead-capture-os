begin;

-- CRM Phase 2.7 App Settings Config Plan
-- Proposal only. Do not execute without review and explicit approval.
-- Historical draft. For any future reviewed migration, prefer the strengthened
-- Phase 3.1 proposal in docs/CRM_PHASE_3_0_EDITABLE_SETTINGS_PLAN.sql.
--
-- Goal:
-- Move CRM operational settings from code defaults into a brand-scoped,
-- auditable configuration layer. This must not change public lead submission,
-- Google Sheets sync, Pixel, thank_you_redirect, consent, form tokens,
-- WhatsApp behavior, Wix embed tracking, or any Meta event sending.

create table if not exists public.crm_app_settings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid null references public.brands(id) on delete cascade,
  brand_slug text null,
  config_group text not null,
  config_key text not null,
  label text not null,
  value_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_app_settings_scope_key_unique unique (
    brand_id,
    brand_slug,
    config_group,
    config_key
  )
);

create index if not exists crm_app_settings_group_idx
  on public.crm_app_settings(config_group, enabled, sort_order);

create index if not exists crm_app_settings_brand_slug_idx
  on public.crm_app_settings(brand_slug, config_group, enabled, sort_order)
  where brand_slug is not null;

comment on table public.crm_app_settings is
  'Future CRM operational settings. Proposal only until reviewed and applied.';

comment on column public.crm_app_settings.config_group is
  'Examples: crm_status_labels, lost_reasons, invalid_reasons, contact_channels, follow_up_outcomes, quick_replies, ai_reply_tone, booking_templates, treatment_faq_replies, room_options, paid_status_labels.';

comment on column public.crm_app_settings.value_json is
  'Structured setting value. Store operational templates and labels only; do not store customer PII or secrets.';

-- Example seed shape for a future reviewed migration:
--
-- insert into public.crm_app_settings
--   (brand_slug, config_group, config_key, label, value_json, sort_order)
-- values
--   (null, 'lost_reasons', 'price_concern', '價錢考慮', '{"value":"price_concern"}', 20),
--   (null, 'contact_channels', 'whatsapp', 'WhatsApp', '{"value":"whatsapp"}', 10),
--   (null, 'quick_replies', 'first_follow_up', '首次跟進', '{"body":"你好，我哋收到你嘅登記，想同你確認預約資料同方便時間。"}', 10)
-- on conflict do nothing;

rollback;
