begin;

-- CRM Phase 3.1 Editable Settings SQL Review + Safe Apply Path
-- Proposal only. Do not execute without review and explicit approval.
--
-- Goal:
-- Create a future auditable, brand-aware CRM settings layer while keeping
-- src/lib/crm/settingsConfig.ts as the safe fallback.
--
-- This proposal must not change public lead submission, Google Sheets sync,
-- Pixel / CompleteRegistration, thank_you_redirect, consent, form tokens,
-- manual WhatsApp open behavior, Wix embed tracking, WhatsApp API behavior,
-- Meta API behavior, or booking status semantics.

-- =========================================================
-- 1) Future settings table
-- =========================================================

create table if not exists public.crm_app_settings (
  id uuid primary key default gen_random_uuid(),

  -- Scope:
  -- global = default settings for every brand.
  -- brand = brand override. Prefer brand_id when available; brand_slug remains
  -- useful for import/export, admin readability, and fallback matching.
  setting_scope text not null default 'global',
  brand_id uuid null references public.brands(id) on delete cascade,
  brand_slug text null,

  -- Examples:
  -- crm_status_labels, lost_reasons, invalid_reasons, contact_channels,
  -- follow_up_outcomes, quick_replies, ai_reply_drafts, ai_reply_tone,
  -- booking_confirmation_templates, treatment_faq_replies, room_options,
  -- paid_status_labels, inbox_column_presets.
  config_group text not null,
  config_key text not null,

  label text not null,
  description text null,
  value_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order integer not null default 0,

  -- Governance / audit:
  version integer not null default 1,
  locked boolean not null default false,
  internal_note text null,
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_app_settings_scope_check check (
    setting_scope in ('global', 'brand')
  ),
  constraint crm_app_settings_scope_brand_check check (
    (
      setting_scope = 'global'
      and brand_id is null
      and brand_slug is null
    )
    or
    (
      setting_scope = 'brand'
      and (brand_id is not null or nullif(trim(coalesce(brand_slug, '')), '') is not null)
    )
  ),
  constraint crm_app_settings_required_text_check check (
    length(trim(config_group)) > 0
    and length(trim(config_key)) > 0
    and length(trim(label)) > 0
  ),
  constraint crm_app_settings_value_is_object check (
    jsonb_typeof(value_json) = 'object'
  )
);

-- Nullable columns cannot safely enforce scoped uniqueness through a single
-- ordinary unique constraint. Use partial unique indexes instead.
create unique index if not exists crm_app_settings_global_key_uidx
  on public.crm_app_settings(config_group, config_key)
  where setting_scope = 'global';

create unique index if not exists crm_app_settings_brand_id_key_uidx
  on public.crm_app_settings(brand_id, config_group, config_key)
  where setting_scope = 'brand' and brand_id is not null;

create unique index if not exists crm_app_settings_brand_slug_key_uidx
  on public.crm_app_settings(lower(brand_slug), config_group, config_key)
  where setting_scope = 'brand' and brand_id is null and brand_slug is not null;

create index if not exists crm_app_settings_group_idx
  on public.crm_app_settings(config_group, enabled, sort_order);

create index if not exists crm_app_settings_scope_group_idx
  on public.crm_app_settings(setting_scope, config_group, enabled, sort_order);

create index if not exists crm_app_settings_brand_id_idx
  on public.crm_app_settings(brand_id, config_group, enabled, sort_order)
  where brand_id is not null;

create index if not exists crm_app_settings_brand_slug_idx
  on public.crm_app_settings(lower(brand_slug), config_group, enabled, sort_order)
  where brand_slug is not null;

create index if not exists crm_app_settings_updated_at_idx
  on public.crm_app_settings(updated_at desc);

comment on table public.crm_app_settings is
  'Future CRM operational settings. Proposal only until reviewed and applied.';

comment on column public.crm_app_settings.setting_scope is
  'global for defaults; brand for brand-specific overrides.';

comment on column public.crm_app_settings.value_json is
  'Structured operational value. Store labels, template body, metadata, validation hints, and column definitions only; do not store customer PII or secrets.';

comment on column public.crm_app_settings.locked is
  'When true, future admin UI should prevent editing because the setting is system-critical.';

-- =========================================================
-- 2) Future audit table
-- =========================================================

create table if not exists public.crm_app_settings_audit (
  id uuid primary key default gen_random_uuid(),
  setting_id uuid null references public.crm_app_settings(id) on delete set null,
  action text not null,
  actor text null,
  previous_value_json jsonb null,
  next_value_json jsonb null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint crm_app_settings_audit_action_check check (
    action in ('created', 'updated', 'enabled', 'disabled', 'locked', 'unlocked', 'deleted')
  ),
  constraint crm_app_settings_audit_metadata_object check (
    jsonb_typeof(metadata_json) = 'object'
  )
);

create index if not exists crm_app_settings_audit_setting_idx
  on public.crm_app_settings_audit(setting_id, created_at desc);

create index if not exists crm_app_settings_audit_action_idx
  on public.crm_app_settings_audit(action, created_at desc);

comment on table public.crm_app_settings_audit is
  'Future audit trail for CRM settings changes. No customer PII or secrets should be stored.';

-- =========================================================
-- 3) Future updated_at trigger
-- =========================================================

create or replace function public.set_crm_app_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.version = coalesce(old.version, 0) + 1;
  return new;
end;
$$;

drop trigger if exists crm_app_settings_set_updated_at on public.crm_app_settings;

create trigger crm_app_settings_set_updated_at
before update on public.crm_app_settings
for each row execute function public.set_crm_app_settings_updated_at();

-- =========================================================
-- 4) RLS / permission boundary proposal
-- =========================================================

alter table public.crm_app_settings enable row level security;
alter table public.crm_app_settings_audit enable row level security;

-- Intentionally do not add broad anon/public policies.
-- Future admin mutation should go through server-only admin actions using the
-- Supabase service role, plus the LaunchHub admin password gate.
--
-- If authenticated admin roles are reintroduced later, add narrow policies
-- for read/write after reviewing the role model. Until then, service-role
-- server code can bypass RLS; browser clients cannot mutate settings directly.

-- =========================================================
-- 5) Future seed examples
-- =========================================================

-- Keep seed examples commented until reviewed. Real seed values should mirror
-- src/lib/crm/settingsConfig.ts and be inserted only after fallback behavior is
-- verified.
--
-- insert into public.crm_app_settings
--   (setting_scope, config_group, config_key, label, description, value_json, sort_order)
-- values
--   (
--     'global',
--     'lost_reasons',
--     'price_concern',
--     '價錢疑問',
--     'Customer indicates price concern.',
--     '{"value":"price_concern"}',
--     20
--   ),
--   (
--     'global',
--     'inbox_column_presets',
--     'cs_booking',
--     'CS Booking View',
--     'Default CS booking-first inbox columns.',
--     '{"columns":["last_contact","assigned_to","customer","whatsapp","status","phone","treatment_offer","preferred_appointment","confirmed_booking","follow_up","outcome","actions"]}',
--     10
--   )
-- on conflict do nothing;

-- =========================================================
-- 6) Apply checklist before replacing rollback with commit
-- =========================================================

-- [ ] Preview table creation in a staging Supabase project.
-- [ ] Verify partial unique indexes prevent duplicate global and brand keys.
-- [ ] Verify standard indexes support group, brand, and updated_at reads.
-- [ ] Verify RLS is enabled and no anon/public mutation policy exists.
-- [ ] Verify admin-only mutation boundary uses server-only service role code.
-- [ ] Seed default config safely from src/lib/crm/settingsConfig.ts.
-- [ ] Verify malformed / disabled / missing DB records fall back to code defaults.
-- [ ] Verify /crm/settings reads code defaults if DB config is missing.
-- [ ] Verify lead detail remains booking-first.
-- [ ] Verify form submission = new / 待跟進, not booked.
-- [ ] Verify inbox column presets fall back to code defaults if DB records are missing.
-- [ ] Verify no public form, UTM/lh tracking, Google Sheets, Pixel, consent,
--     thank_you_redirect, form token, WhatsApp, Wix embed, or Meta behavior is affected.
-- [ ] Verify no customer PII, raw WhatsApp tokens, Meta access tokens, lead IDs,
--     or free-text lead notes are stored in reusable settings records.

rollback;
