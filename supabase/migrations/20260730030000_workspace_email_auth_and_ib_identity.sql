-- Invite-only company email authentication and clear in-app brand identity.
-- The shared-password gate remains available during rollout and can be
-- disabled only after the owner has accepted a verified email invitation.

alter table public.workspace_members
  add column if not exists invited_by_member_id uuid null,
  add column if not exists invited_by_email text null,
  add column if not exists invite_sent_at timestamptz null,
  add column if not exists invite_accepted_at timestamptz null,
  add column if not exists last_sign_in_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_auth_user_id_fkey'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_invited_by_member_id_fkey'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_invited_by_member_id_fkey
      foreign key (invited_by_member_id)
      references public.workspace_members(id)
      on delete set null;
  end if;
end
$$;

create index if not exists workspace_members_status_email_idx
  on public.workspace_members(status, lower(email));

create index if not exists workspace_members_invited_by_member_id_idx
  on public.workspace_members(invited_by_member_id);

alter table public.workspace_member_module_permissions
  drop constraint if exists workspace_member_module_permissions_key_check;

alter table public.workspace_member_module_permissions
  add constraint workspace_member_module_permissions_key_check
  check (module_key in (
    'dashboard',
    'kpis',
    'calendar',
    'launchhub',
    'leads',
    'crm',
    'performance',
    'data_sources',
    'settings',
    'system_audit'
  ));

comment on column public.workspace_members.auth_user_id is
  'Verified Supabase Auth identity. Access is denied when the authenticated email does not match this invited workspace member.';
comment on column public.workspace_members.invite_sent_at is
  'Latest successful invite or passwordless sign-in email dispatch timestamp.';
comment on column public.workspace_members.invite_accepted_at is
  'First successful verification of an invite-only company email identity.';

-- The dashboard views are only read by the server-side service role. Make
-- their RLS behaviour explicit so they never inherit the view creator's
-- privileges when queried through another database role.
alter view public.dashboard_lead_source_performance
  set (security_invoker = true);
alter view public.dashboard_attribution_audit
  set (security_invoker = true);

-- Harden trigger functions that may also exist in environments created from
-- the operational CRM SQL packs. A fixed search path prevents object shadowing.
do $$
begin
  if to_regprocedure('public.set_crm_app_settings_updated_at()') is not null then
    alter function public.set_crm_app_settings_updated_at()
      set search_path = public;
  end if;
  if to_regprocedure('public.audit_crm_app_settings_change()') is not null then
    alter function public.audit_crm_app_settings_change()
      set search_path = public;
  end if;
  if to_regprocedure('public.set_whatsapp_updated_at()') is not null then
    alter function public.set_whatsapp_updated_at()
      set search_path = public;
  end if;
  if to_regprocedure('public.set_whatsapp_conversation_updated_at()') is not null then
    alter function public.set_whatsapp_conversation_updated_at()
      set search_path = public;
  end if;
end
$$;

-- Internal Growth OS representation: Ineffable Beauty is identified by a
-- sky-blue color marker instead of a logo. Public marketing assets remain
-- independently managed by Landing Page content.
update public.brands
set
  primary_color = '#69C7E8',
  secondary_color = '#DFF4FB',
  logo_url = null,
  updated_at = now()
where lower(slug) in ('ineffable', 'ineffable-beauty');
