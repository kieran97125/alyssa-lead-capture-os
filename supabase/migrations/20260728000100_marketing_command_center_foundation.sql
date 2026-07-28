-- Alyssa Marketing Command Center foundation.
--
-- This migration adds the brand-scoped planning, spend, source, calendar and
-- workspace-member records needed by the internal Growth OS. Provider secrets
-- are deliberately excluded: data source rows may only contain public
-- identifiers, mappings and a reference to credentials held elsewhere.

create table if not exists public.marketing_monthly_plans (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  month_start date not null,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  currency text not null default 'HKD',
  lead_target integer not null default 0 check (lead_target >= 0),
  booking_target integer not null default 0 check (booking_target >= 0),
  show_target integer not null default 0 check (show_target >= 0),
  content_target integer not null default 0 check (content_target >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, month_start),
  constraint marketing_monthly_plans_month_start_check
    check (month_start = date_trunc('month', month_start)::date)
);

create table if not exists public.marketing_data_sources (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid null references public.brands(id) on delete cascade,
  provider_key text not null,
  display_name text not null,
  status text not null default 'draft',
  sync_mode text not null default 'manual',
  configuration jsonb not null default '{}'::jsonb,
  credential_reference text null,
  provides_metrics text[] not null default '{}',
  last_sync_at timestamptz null,
  last_success_at timestamptz null,
  last_error_summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_data_sources_provider_check
    check (provider_key in (
      'launchhub',
      'crm',
      'google_sheets',
      'meta_ads',
      'google_ads',
      'manual_csv',
      'n8n'
    )),
  constraint marketing_data_sources_status_check
    check (status in ('draft', 'connected', 'syncing', 'warning', 'error', 'paused')),
  constraint marketing_data_sources_sync_mode_check
    check (sync_mode in ('native', 'webhook', 'scheduled', 'manual'))
);

create index if not exists marketing_data_sources_brand_status_idx
  on public.marketing_data_sources(brand_id, status, provider_key);

create table if not exists public.marketing_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  metric_date date not null,
  source_key text not null,
  data_source_id uuid null references public.marketing_data_sources(id) on delete set null,
  spend numeric(14,2) not null default 0 check (spend >= 0),
  leads integer not null default 0 check (leads >= 0),
  bookings integer not null default 0 check (bookings >= 0),
  shows integer not null default 0 check (shows >= 0),
  revenue numeric(14,2) not null default 0 check (revenue >= 0),
  source_updated_at timestamptz null,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, metric_date, source_key)
);

create index if not exists marketing_daily_metrics_brand_date_idx
  on public.marketing_daily_metrics(brand_id, metric_date);

create table if not exists public.marketing_calendar_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null,
  item_type text not null default 'post',
  channel text null,
  status text not null default 'planned',
  scheduled_date date not null,
  scheduled_time time null,
  assignee_email text null,
  notes text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_calendar_items_type_check
    check (item_type in ('post', 'ad', 'landing_page', 'email', 'meeting', 'task')),
  constraint marketing_calendar_items_status_check
    check (status in ('idea', 'planned', 'in_progress', 'review', 'scheduled', 'published', 'blocked', 'cancelled'))
);

create index if not exists marketing_calendar_items_date_brand_idx
  on public.marketing_calendar_items(scheduled_date, brand_id, sort_order);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null unique,
  email text not null,
  full_name text null,
  workspace_role text not null default 'viewer',
  status text not null default 'invited',
  is_master boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_members_role_check
    check (workspace_role in ('owner', 'admin', 'manager', 'marketer', 'cs', 'designer', 'viewer')),
  constraint workspace_members_status_check
    check (status in ('invited', 'active', 'suspended', 'removed')),
  constraint workspace_members_email_check
    check (position('@' in email) > 1)
);

create unique index if not exists workspace_members_email_lower_idx
  on public.workspace_members(lower(email));

create table if not exists public.workspace_member_brand_access (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  role_override text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, brand_id),
  constraint workspace_member_brand_access_role_check
    check (role_override is null or role_override in ('owner', 'admin', 'manager', 'marketer', 'cs', 'designer', 'viewer')),
  constraint workspace_member_brand_access_status_check
    check (status in ('invited', 'active', 'suspended', 'removed'))
);

create table if not exists public.workspace_member_module_permissions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  module_key text not null,
  can_access boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, module_key),
  constraint workspace_member_module_permissions_key_check
    check (module_key in (
      'dashboard',
      'kpis',
      'calendar',
      'launchhub',
      'leads',
      'crm',
      'data_sources',
      'settings',
      'system_audit'
    ))
);

create table if not exists public.marketing_command_center_audit (
  id uuid primary key default gen_random_uuid(),
  actor_email text null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  brand_id uuid null references public.brands(id) on delete set null,
  before_json jsonb null,
  after_json jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_command_center_audit_created_idx
  on public.marketing_command_center_audit(created_at desc);

create table if not exists public.internal_access_passwords (
  access_level text primary key,
  password_hash text not null,
  updated_at timestamptz not null default now(),
  constraint internal_access_passwords_level_check
    check (access_level in ('admin', 'master'))
);

alter table public.marketing_monthly_plans enable row level security;
alter table public.marketing_data_sources enable row level security;
alter table public.marketing_daily_metrics enable row level security;
alter table public.marketing_calendar_items enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_member_brand_access enable row level security;
alter table public.workspace_member_module_permissions enable row level security;
alter table public.marketing_command_center_audit enable row level security;
alter table public.internal_access_passwords enable row level security;

-- These internal control-plane tables are server-only. Supabase's 2026 Data API
-- defaults no longer guarantee automatic table exposure, so grant the exact
-- service-role privileges explicitly and deny browser roles.
revoke all on table public.marketing_monthly_plans from anon, authenticated;
revoke all on table public.marketing_data_sources from anon, authenticated;
revoke all on table public.marketing_daily_metrics from anon, authenticated;
revoke all on table public.marketing_calendar_items from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;
revoke all on table public.workspace_member_brand_access from anon, authenticated;
revoke all on table public.workspace_member_module_permissions from anon, authenticated;
revoke all on table public.marketing_command_center_audit from anon, authenticated;
revoke all on table public.internal_access_passwords from anon, authenticated;

grant select, insert, update, delete on table public.marketing_monthly_plans to service_role;
grant select, insert, update, delete on table public.marketing_data_sources to service_role;
grant select, insert, update, delete on table public.marketing_daily_metrics to service_role;
grant select, insert, update, delete on table public.marketing_calendar_items to service_role;
grant select, insert, update, delete on table public.workspace_members to service_role;
grant select, insert, update, delete on table public.workspace_member_brand_access to service_role;
grant select, insert, update, delete on table public.workspace_member_module_permissions to service_role;
grant select, insert, update, delete on table public.marketing_command_center_audit to service_role;
grant select, insert, update, delete on table public.internal_access_passwords to service_role;

create or replace function public.verify_internal_access_password(
  candidate_password text
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select credentials.access_level
  from public.internal_access_passwords as credentials
  where credentials.password_hash =
    extensions.crypt(candidate_password, credentials.password_hash)
  limit 1
$$;

revoke all on function public.verify_internal_access_password(text)
  from public, anon, authenticated;
grant execute on function public.verify_internal_access_password(text)
  to service_role;

comment on table public.internal_access_passwords is
  'Server-only salted password hashes for the temporary Alyssa Admin and Master gate. Plaintext passwords must never be stored.';

comment on table public.marketing_daily_metrics is
  'Daily imported aggregates. Metric ownership is declared by each data source; current Alyssa policy uses Google Sheets for spend and lead-funnel reporting.';
comment on column public.marketing_data_sources.configuration is
  'Sanitized provider mapping only. Never store passwords, access tokens or API secrets here.';
comment on column public.marketing_data_sources.credential_reference is
  'Opaque reference to credentials stored in a protected provider-specific secret store.';

insert into public.workspace_members (
  email,
  full_name,
  workspace_role,
  status,
  is_master
)
select
  'kieran.kwok@alyssa.hk',
  'Kieran Kwok',
  'owner',
  'active',
  true
where not exists (
  select 1
  from public.workspace_members
  where lower(email) = 'kieran.kwok@alyssa.hk'
);

update public.workspace_members
set
  full_name = 'Kieran Kwok',
  workspace_role = 'owner',
  status = 'active',
  is_master = true,
  updated_at = now()
where lower(email) = 'kieran.kwok@alyssa.hk';

-- Known operational content cadences are safe defaults, not hard-coded UI
-- rules. Administrators can update them for every later month.
insert into public.marketing_monthly_plans (
  brand_id,
  month_start,
  content_target
)
select
  brands.id,
  date_trunc('month', now() at time zone 'Asia/Hong_Kong')::date,
  case
    when lower(brands.slug) = 'alyssa' then 9
    when lower(brands.slug) in ('ineffable', 'ineffable-beauty') then 4
    else 0
  end
from public.brands
where lower(brands.slug) in ('alyssa', 'ineffable', 'ineffable-beauty')
on conflict (brand_id, month_start) do nothing;

update public.brands
set
  logo_url = '/ineffable-wix/assets/logo.png',
  updated_at = now()
where lower(slug) in ('ineffable', 'ineffable-beauty')
  and coalesce(trim(logo_url), '') = '';

-- Alyssa Enterprise-only Google Sheets registry. These workbook identifiers
-- remain client-specific and must not be copied into Growth OS Core.
insert into public.marketing_data_sources (
  brand_id,
  provider_key,
  display_name,
  status,
  sync_mode,
  configuration,
  provides_metrics
)
select
  brands.id,
  'google_sheets',
  'Alyssa Daily Ad Spend',
  'draft',
  'manual',
  jsonb_build_object(
    'sourceProfile', 'alyssa_daily_ad_spend',
    'dataset', 'daily_spend',
    'spreadsheetId', '1C0nXpBCQC7ROsL1LSonw8CBppihIVIt_zFPaJ_NvDjE',
    'tabName', 'Alyssa',
    'headerRow', 3,
    'maxRows', 5000,
    'dateColumn', 'A',
    'spendColumn', 'N'
  ),
  array['spend']::text[]
from public.brands
where lower(brands.slug) = 'alyssa'
  and not exists (
    select 1
    from public.marketing_data_sources sources
    where sources.configuration ->> 'sourceProfile' = 'alyssa_daily_ad_spend'
  );

insert into public.marketing_data_sources (
  brand_id,
  provider_key,
  display_name,
  status,
  sync_mode,
  configuration,
  provides_metrics
)
select
  brands.id,
  'google_sheets',
  'Ineffable Beauty Daily Ad Spend',
  'draft',
  'manual',
  jsonb_build_object(
    'sourceProfile', 'ineffable_daily_ad_spend',
    'dataset', 'daily_spend',
    'spreadsheetId', '1C0nXpBCQC7ROsL1LSonw8CBppihIVIt_zFPaJ_NvDjE',
    'tabName', 'IB',
    'headerRow', 3,
    'maxRows', 5000,
    'dateColumn', 'A',
    'spendColumn', 'N'
  ),
  array['spend']::text[]
from public.brands
where lower(brands.slug) in ('ineffable', 'ineffable-beauty')
  and not exists (
    select 1
    from public.marketing_data_sources sources
    where sources.configuration ->> 'sourceProfile' = 'ineffable_daily_ad_spend'
  );

insert into public.marketing_data_sources (
  brand_id,
  provider_key,
  display_name,
  status,
  sync_mode,
  configuration,
  provides_metrics
)
select
  null,
  'google_sheets',
  'Alyssa Workspace Lead Funnel',
  'draft',
  'manual',
  jsonb_build_object(
    'sourceProfile', 'alyssa_workspace_lead_funnel',
    'dataset', 'lead_funnel',
    'spreadsheetId', '1Uq1-QkNgC4r3B3KcaBwp5Y7KXE3T3ZlR9maAML4dWAY',
    'tabName', 'lead',
    'headerRow', 1,
    'maxRows', 5000,
    'createdAtColumn', 'A',
    'followStatusColumn', 'B',
    'brandColumn', 'C',
    'bookingDateColumn', 'J',
    'confirmationDateColumn', 'L'
  ),
  array['leads', 'bookings', 'shows']::text[]
where not exists (
  select 1
  from public.marketing_data_sources sources
  where sources.configuration ->> 'sourceProfile' =
    'alyssa_workspace_lead_funnel'
);

-- Manual refresh is the rollout default. Keep this idempotent so a partially
-- applied pilot environment does not retain the earlier scheduled mode.
update public.marketing_data_sources
set
  sync_mode = 'manual',
  updated_at = now()
where configuration ->> 'sourceProfile' in (
  'alyssa_daily_ad_spend',
  'ineffable_daily_ad_spend',
  'alyssa_workspace_lead_funnel'
);
