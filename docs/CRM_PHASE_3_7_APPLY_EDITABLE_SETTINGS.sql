-- CRM Phase 3.7A Apply Editable Settings
-- Final reviewed migration file. Do not execute until explicitly approved.
--
-- Apply checklist:
-- [ ] Confirm this file is run only in the intended Supabase project.
-- [ ] Confirm public lead submission, Google Sheets sync, Pixel, thank_you_redirect,
--     consent, form tokens, WhatsApp manual open, Wix embed tracking, and CRM booking
--     status semantics are out of scope for this migration.
-- [ ] Confirm `src/lib/crm/settingsLoader.ts` can still fall back to code defaults.
-- [ ] Confirm the app server has service-role access for future admin-only reads/writes.
-- [ ] Confirm no anon/public RLS policies are added.
-- [ ] Apply migration in staging first.
-- [ ] Verify tables, indexes, triggers, RLS, and comments with the queries at the bottom.
-- [ ] Only after verification, add minimal seed data in a separate reviewed step.
--
-- Scope:
-- - Creates `public.crm_app_settings` for future editable CRM operational settings.
-- - Creates `public.crm_app_settings_audit` for future audit records.
-- - Adds indexes, updated_at/version trigger, audit trigger, comments, and RLS.
-- - Does not mutate public lead tables, CRM lead case statuses, tracking, Pixel,
--   Google Sheets, forms, consent, WhatsApp, or Meta behavior.

-- Supabase normally exposes gen_random_uuid(). Keep this extension idempotent.
create extension if not exists pgcrypto with schema extensions;

-- =========================================================
-- 1) Editable settings table
-- =========================================================

create table if not exists public.crm_app_settings (
  id uuid primary key default gen_random_uuid(),

  -- Scope:
  -- global = default settings for every brand.
  -- brand = brand override. Prefer brand_id when available; brand_slug remains useful
  -- for import/export, admin readability, and fallback matching.
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

  -- Governance:
  locked boolean not null default false,
  version integer not null default 1,
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
      and (
        brand_id is not null
        or nullif(trim(coalesce(brand_slug, '')), '') is not null
      )
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

comment on table public.crm_app_settings is
  'Editable CRM operational settings for admin-managed CS workflows. Public clients must not mutate this table.';

comment on column public.crm_app_settings.setting_scope is
  'global for defaults; brand for brand-specific overrides.';

comment on column public.crm_app_settings.brand_id is
  'Preferred stable brand reference for brand-level overrides when available.';

comment on column public.crm_app_settings.brand_slug is
  'Readable/fallback brand key for imports, previews, and slug-based resolution.';

comment on column public.crm_app_settings.config_group is
  'Settings category, for example lost_reasons, quick_replies, ai_reply_drafts, room_options, or inbox_column_presets.';

comment on column public.crm_app_settings.config_key is
  'Stable key inside the config group. Must be unique within its effective scope.';

comment on column public.crm_app_settings.value_json is
  'Structured operational value. Store labels, templates, metadata, validation hints, and column definitions only. Do not store customer PII or secrets.';

comment on column public.crm_app_settings.locked is
  'When true, future admin UI should prevent editing because the setting is system-critical.';

comment on column public.crm_app_settings.version is
  'Incremented by trigger on every update for optimistic/audit-friendly settings changes.';

-- Nullable columns cannot safely enforce scoped uniqueness through one ordinary
-- unique constraint. Use partial unique indexes instead.
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

-- =========================================================
-- 2) Settings audit table
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
  constraint crm_app_settings_audit_previous_value_object check (
    previous_value_json is null or jsonb_typeof(previous_value_json) = 'object'
  ),
  constraint crm_app_settings_audit_next_value_object check (
    next_value_json is null or jsonb_typeof(next_value_json) = 'object'
  ),
  constraint crm_app_settings_audit_metadata_object check (
    jsonb_typeof(metadata_json) = 'object'
  )
);

comment on table public.crm_app_settings_audit is
  'Audit trail for CRM settings changes. Store operational setting diffs only; no customer PII or secrets.';

comment on column public.crm_app_settings_audit.actor is
  'Future admin actor identifier. Keep null-safe until a full admin user model exists.';

comment on column public.crm_app_settings_audit.metadata_json is
  'Audit metadata such as scope, group/key, enabled/locked transitions, or request context. Do not store secrets.';

create index if not exists crm_app_settings_audit_setting_idx
  on public.crm_app_settings_audit(setting_id, created_at desc);

create index if not exists crm_app_settings_audit_action_idx
  on public.crm_app_settings_audit(action, created_at desc);

create index if not exists crm_app_settings_audit_created_at_idx
  on public.crm_app_settings_audit(created_at desc);

-- =========================================================
-- 3) updated_at, version, and audit triggers
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

comment on function public.set_crm_app_settings_updated_at() is
  'Maintains updated_at and increments version for crm_app_settings updates.';

create or replace function public.audit_crm_app_settings_change()
returns trigger
language plpgsql
as $$
declare
  audit_action text;
begin
  if tg_op = 'INSERT' then
    audit_action := 'created';

    insert into public.crm_app_settings_audit (
      setting_id,
      action,
      actor,
      previous_value_json,
      next_value_json,
      metadata_json
    )
    values (
      new.id,
      audit_action,
      coalesce(new.updated_by, new.created_by),
      null,
      new.value_json,
      jsonb_build_object(
        'setting_scope', new.setting_scope,
        'brand_id', new.brand_id,
        'brand_slug', new.brand_slug,
        'config_group', new.config_group,
        'config_key', new.config_key,
        'enabled', new.enabled,
        'locked', new.locked,
        'version', new.version
      )
    );

    return new;
  end if;

  if tg_op = 'UPDATE' then
    audit_action := case
      when old.enabled is distinct from new.enabled and new.enabled = true then 'enabled'
      when old.enabled is distinct from new.enabled and new.enabled = false then 'disabled'
      when old.locked is distinct from new.locked and new.locked = true then 'locked'
      when old.locked is distinct from new.locked and new.locked = false then 'unlocked'
      else 'updated'
    end;

    insert into public.crm_app_settings_audit (
      setting_id,
      action,
      actor,
      previous_value_json,
      next_value_json,
      metadata_json
    )
    values (
      new.id,
      audit_action,
      new.updated_by,
      old.value_json,
      new.value_json,
      jsonb_build_object(
        'setting_scope', new.setting_scope,
        'brand_id', new.brand_id,
        'brand_slug', new.brand_slug,
        'config_group', new.config_group,
        'config_key', new.config_key,
        'old_enabled', old.enabled,
        'new_enabled', new.enabled,
        'old_locked', old.locked,
        'new_locked', new.locked,
        'old_version', old.version,
        'new_version', new.version
      )
    );

    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.crm_app_settings_audit (
      setting_id,
      action,
      actor,
      previous_value_json,
      next_value_json,
      metadata_json
    )
    values (
      old.id,
      'deleted',
      old.updated_by,
      old.value_json,
      null,
      jsonb_build_object(
        'setting_scope', old.setting_scope,
        'brand_id', old.brand_id,
        'brand_slug', old.brand_slug,
        'config_group', old.config_group,
        'config_key', old.config_key,
        'enabled', old.enabled,
        'locked', old.locked,
        'version', old.version
      )
    );

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists crm_app_settings_audit_change on public.crm_app_settings;

create trigger crm_app_settings_audit_change
after insert or update or delete on public.crm_app_settings
for each row execute function public.audit_crm_app_settings_change();

comment on function public.audit_crm_app_settings_change() is
  'Writes audit rows for crm_app_settings inserts, updates, enable/disable, lock/unlock, and deletes.';

-- =========================================================
-- 4) RLS boundary
-- =========================================================

alter table public.crm_app_settings enable row level security;
alter table public.crm_app_settings_audit enable row level security;

comment on table public.crm_app_settings is
  'Editable CRM operational settings. RLS enabled; access is intended for server-only admin/service-role code.';

comment on table public.crm_app_settings_audit is
  'CRM settings audit trail. RLS enabled; no anon/public access policy is created.';

-- Intentionally do not add anon/public policies.
-- Future admin mutation should go through server-only actions using the Supabase
-- service role, behind LaunchHub admin protection. Browser clients must not
-- receive service-role credentials and must not mutate settings directly.

-- =========================================================
-- 5) Minimal seed data
-- =========================================================

-- No default data is seeded in this migration.
-- Reason: code defaults in `src/lib/crm/settingsConfig.ts` remain the safety net.
-- Seed operational defaults in a separate reviewed script after DB read behavior
-- is verified in staging.

-- =========================================================
-- 6) Post-apply verification queries
-- =========================================================

-- Verify tables exist:
-- select table_schema, table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in ('crm_app_settings', 'crm_app_settings_audit')
-- order by table_name;

-- Verify columns:
-- select table_name, column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('crm_app_settings', 'crm_app_settings_audit')
-- order by table_name, ordinal_position;

-- Verify indexes:
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename in ('crm_app_settings', 'crm_app_settings_audit')
-- order by tablename, indexname;

-- Verify triggers:
-- select event_object_table, trigger_name, action_timing, event_manipulation
-- from information_schema.triggers
-- where event_object_schema = 'public'
--   and event_object_table in ('crm_app_settings', 'crm_app_settings_audit')
-- order by event_object_table, trigger_name, event_manipulation;

-- Verify RLS is enabled:
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and tablename in ('crm_app_settings', 'crm_app_settings_audit');

-- Verify no anon/public policies exist:
-- select schemaname, tablename, policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('crm_app_settings', 'crm_app_settings_audit')
-- order by tablename, policyname;

-- Optional service-role smoke test, run only in a safe environment:
-- insert into public.crm_app_settings (
--   setting_scope,
--   config_group,
--   config_key,
--   label,
--   description,
--   value_json,
--   sort_order,
--   created_by,
--   updated_by
-- )
-- values (
--   'global',
--   'contact_channels',
--   'phase_3_7_smoke_test',
--   'Phase 3.7 smoke test',
--   'Temporary test row. Delete after verification.',
--   '{"value":"phase_3_7_smoke_test"}',
--   9999,
--   'migration_smoke_test',
--   'migration_smoke_test'
-- )
-- on conflict (config_group, config_key)
-- where setting_scope = 'global'
-- do update set
--   label = excluded.label,
--   description = excluded.description,
--   value_json = excluded.value_json,
--   updated_by = 'migration_smoke_test';
--
-- select id, setting_scope, config_group, config_key, label, version, created_at, updated_at
-- from public.crm_app_settings
-- where config_group = 'contact_channels'
--   and config_key = 'phase_3_7_smoke_test';
--
-- select action, actor, metadata_json, created_at
-- from public.crm_app_settings_audit
-- where metadata_json ->> 'config_key' = 'phase_3_7_smoke_test'
-- order by created_at desc;
--
-- delete from public.crm_app_settings
-- where config_group = 'contact_channels'
--   and config_key = 'phase_3_7_smoke_test';
