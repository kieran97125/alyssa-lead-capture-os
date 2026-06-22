-- LeadOps CRM Phase 2B additive fix script.
-- Use only after reviewing CRM_PHASE2_APPLY.sql and the live table definitions.
-- Scope: CRM tables only. No LaunchHub lead/source/payment/legal/public tables are altered.
-- This file is safe to run repeatedly: it uses add column if not exists,
-- grants service_role access, and reloads the PostgREST schema cache.

alter table if exists public.crm_contacts
  add column if not exists tenant_id uuid null,
  add column if not exists brand_slug text,
  add column if not exists normalized_phone text,
  add column if not exists display_name text null,
  add column if not exists email text null,
  add column if not exists first_seen_at timestamptz null,
  add column if not exists last_activity_at timestamptz null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists crm_contacts_brand_phone_unique_idx
  on public.crm_contacts (brand_slug, normalized_phone)
  where brand_slug is not null and normalized_phone is not null;

alter table if exists public.crm_lead_cases
  add column if not exists contact_id uuid null,
  add column if not exists source_lead_id uuid null,
  add column if not exists brand_slug text,
  add column if not exists status text not null default 'new',
  add column if not exists assigned_to text null,
  add column if not exists treatment_label text null,
  add column if not exists offer_label text null,
  add column if not exists source_type text not null default 'unknown',
  add column if not exists source_label text null,
  add column if not exists landing_page_slug text null,
  add column if not exists page_url text null,
  add column if not exists form_token text null,
  add column if not exists utm_source text null,
  add column if not exists utm_campaign text null,
  add column if not exists ctwa_source_id text null,
  add column if not exists ctwa_source_url text null,
  add column if not exists ctwa_referral_headline text null,
  add column if not exists ctwa_referral_body text null,
  add column if not exists campaign_id text null,
  add column if not exists adset_id text null,
  add column if not exists ad_id text null,
  add column if not exists phone_number_id text null,
  add column if not exists whatsapp_business_account_id text null,
  add column if not exists next_follow_up_at timestamptz null,
  add column if not exists booking_id uuid null,
  add column if not exists lost_reason text null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists crm_lead_cases_source_lead_unique_idx
  on public.crm_lead_cases (source_lead_id)
  where source_lead_id is not null;

create index if not exists crm_lead_cases_contact_idx
  on public.crm_lead_cases (contact_id, updated_at desc);

create index if not exists crm_lead_cases_brand_status_idx
  on public.crm_lead_cases (brand_slug, status, updated_at desc);

alter table if exists public.crm_interactions
  add column if not exists case_id uuid null,
  add column if not exists contact_id uuid null,
  add column if not exists interaction_type text,
  add column if not exists direction text null,
  add column if not exists body text null,
  add column if not exists author text null,
  add column if not exists source_type text null,
  add column if not exists external_message_id text null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create index if not exists crm_interactions_case_created_idx
  on public.crm_interactions (case_id, created_at desc);

alter table if exists public.crm_status_history
  add column if not exists case_id uuid null,
  add column if not exists previous_status text null,
  add column if not exists new_status text,
  add column if not exists changed_by text null,
  add column if not exists note text null,
  add column if not exists created_at timestamptz not null default now();

create index if not exists crm_status_history_case_created_idx
  on public.crm_status_history (case_id, created_at desc);

alter table if exists public.crm_bookings
  add column if not exists case_id uuid null,
  add column if not exists contact_id uuid null,
  add column if not exists brand_slug text,
  add column if not exists branch_label text null,
  add column if not exists treatment_label text null,
  add column if not exists booking_date date null,
  add column if not exists booking_time time null,
  add column if not exists status text not null default 'tentative',
  add column if not exists created_by text null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists crm_bookings_case_idx
  on public.crm_bookings (case_id, created_at desc);

alter table if exists public.crm_follow_up_tasks
  add column if not exists case_id uuid null,
  add column if not exists contact_id uuid null,
  add column if not exists assigned_to text null,
  add column if not exists due_at timestamptz null,
  add column if not exists task_type text null,
  add column if not exists note text null,
  add column if not exists status text not null default 'open',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists crm_follow_up_tasks_due_idx
  on public.crm_follow_up_tasks (status, due_at asc);

grant all on table
  public.crm_contacts,
  public.crm_lead_cases,
  public.crm_interactions,
  public.crm_status_history,
  public.crm_bookings,
  public.crm_follow_up_tasks
to service_role;

-- Keep RLS enabled. These policies are service_role-only and do not grant
-- anon/public browser access.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_contacts'
      and policyname = 'crm_contacts_service_role_all'
  ) then
    create policy crm_contacts_service_role_all
      on public.crm_contacts
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_lead_cases'
      and policyname = 'crm_lead_cases_service_role_all'
  ) then
    create policy crm_lead_cases_service_role_all
      on public.crm_lead_cases
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_interactions'
      and policyname = 'crm_interactions_service_role_all'
  ) then
    create policy crm_interactions_service_role_all
      on public.crm_interactions
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_status_history'
      and policyname = 'crm_status_history_service_role_all'
  ) then
    create policy crm_status_history_service_role_all
      on public.crm_status_history
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_bookings'
      and policyname = 'crm_bookings_service_role_all'
  ) then
    create policy crm_bookings_service_role_all
      on public.crm_bookings
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'crm_follow_up_tasks'
      and policyname = 'crm_follow_up_tasks_service_role_all'
  ) then
    create policy crm_follow_up_tasks_service_role_all
      on public.crm_follow_up_tasks
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

notify pgrst, 'reload schema';
