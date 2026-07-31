-- Master-owned member directory, atomic access updates and honest invitation
-- delivery state. Auth email delivery remains owned by Supabase Auth; the app
-- records whether the provider accepted the request rather than claiming that
-- a mailbox received it.

alter table public.workspace_members
  add column if not exists invite_attempted_at timestamptz null,
  add column if not exists invite_delivery_status text not null default 'not_sent',
  add column if not exists invite_last_error_code text null,
  add column if not exists permissions_updated_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_members_invite_delivery_status_check'
  ) then
    alter table public.workspace_members
      add constraint workspace_members_invite_delivery_status_check
      check (
        invite_delivery_status in (
          'not_sent',
          'submitted',
          'failed',
          'accepted',
          'delivered',
          'bounced',
          'complained',
          'suppressed'
        )
      );
  end if;
end
$$;

update public.workspace_members
set
  invite_delivery_status = case
    when invite_accepted_at is not null then 'accepted'
    when invite_sent_at is not null then 'submitted'
    else invite_delivery_status
  end,
  invite_attempted_at = coalesce(invite_attempted_at, invite_sent_at),
  permissions_updated_at = coalesce(permissions_updated_at, updated_at)
where
  invite_accepted_at is not null
  or invite_sent_at is not null
  or permissions_updated_at is null;

comment on column public.workspace_members.invite_attempted_at is
  'Most recent Master-initiated invitation or sign-in email attempt.';
comment on column public.workspace_members.invite_sent_at is
  'Latest auth email request accepted by the provider; this timestamp does not assert mailbox delivery.';
comment on column public.workspace_members.invite_delivery_status is
  'Provider lifecycle state. submitted means the provider accepted the request; it does not assert mailbox delivery.';
comment on column public.workspace_members.invite_last_error_code is
  'Sanitized provider error code from the latest failed invitation attempt.';
comment on column public.workspace_members.permissions_updated_at is
  'Most recent successful atomic role, brand or module permission update.';

create or replace function public.create_workspace_member_invitation(
  p_email text,
  p_full_name text,
  p_workspace_role text,
  p_brand_ids uuid[],
  p_module_keys text[],
  p_invited_by_member_id uuid,
  p_invited_by_email text
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  normalized_role text := lower(btrim(coalesce(p_workspace_role, 'viewer')));
  target_member public.workspace_members%rowtype;
  target_member_id uuid;
  changed_at timestamptz := now();
begin
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_email';
  end if;

  if normalized_role not in (
    'admin',
    'manager',
    'marketer',
    'cs',
    'designer',
    'viewer'
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_role';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_brand_ids, array[]::uuid[])) as requested(brand_id)
    left join public.brands as brand on brand.id = requested.brand_id
    where brand.id is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_brand';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_module_keys, array[]::text[])) as requested(module_key)
    where requested.module_key not in (
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
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_module';
  end if;

  -- Serialize invitations for the same normalized email so two Master clicks
  -- cannot create duplicate permission sets around the expression index.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(normalized_email, 0)
  );

  select *
  into target_member
  from public.workspace_members
  where lower(email) = normalized_email
  for update;

  if found and target_member.is_master then
    raise exception using
      errcode = '42501',
      message = 'master_member_is_immutable';
  end if;

  if found and target_member.status <> 'removed' then
    raise exception using
      errcode = '23505',
      message = 'workspace_member_already_exists';
  end if;

  if found then
    target_member_id := target_member.id;
    update public.workspace_members
    set
      full_name = nullif(btrim(coalesce(p_full_name, '')), ''),
      workspace_role = normalized_role,
      status = 'invited',
      invited_by_member_id = p_invited_by_member_id,
      invited_by_email = nullif(btrim(coalesce(p_invited_by_email, '')), ''),
      invite_attempted_at = null,
      invite_sent_at = null,
      invite_accepted_at = null,
      last_sign_in_at = null,
      invite_delivery_status = 'not_sent',
      invite_last_error_code = null,
      permissions_updated_at = changed_at,
      updated_at = changed_at
    where id = target_member_id;
  else
    insert into public.workspace_members (
      email,
      full_name,
      workspace_role,
      status,
      is_master,
      invited_by_member_id,
      invited_by_email,
      invite_delivery_status,
      permissions_updated_at,
      updated_at
    )
    values (
      normalized_email,
      nullif(btrim(coalesce(p_full_name, '')), ''),
      normalized_role,
      'invited',
      false,
      p_invited_by_member_id,
      nullif(btrim(coalesce(p_invited_by_email, '')), ''),
      'not_sent',
      changed_at,
      changed_at
    )
    returning id into target_member_id;
  end if;

  delete from public.workspace_member_brand_access
  where member_id = target_member_id;

  insert into public.workspace_member_brand_access (
    member_id,
    brand_id,
    status,
    created_at,
    updated_at
  )
  select
    target_member_id,
    requested.brand_id,
    'active',
    changed_at,
    changed_at
  from (
    select distinct brand_id
    from unnest(coalesce(p_brand_ids, array[]::uuid[])) as input(brand_id)
  ) as requested;

  delete from public.workspace_member_module_permissions
  where member_id = target_member_id;

  insert into public.workspace_member_module_permissions (
    member_id,
    module_key,
    can_access,
    created_at,
    updated_at
  )
  select
    target_member_id,
    requested.module_key,
    true,
    changed_at,
    changed_at
  from (
    select distinct module_key
    from unnest(coalesce(p_module_keys, array[]::text[])) as input(module_key)
  ) as requested;

  return target_member_id;
end;
$$;

create or replace function public.update_workspace_member_access(
  p_member_id uuid,
  p_full_name text,
  p_workspace_role text,
  p_brand_ids uuid[],
  p_module_keys text[]
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  normalized_role text := lower(btrim(coalesce(p_workspace_role, 'viewer')));
  target_member public.workspace_members%rowtype;
  changed_at timestamptz := now();
begin
  select *
  into target_member
  from public.workspace_members
  where id = p_member_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'workspace_member_not_found';
  end if;

  if target_member.is_master or target_member.workspace_role = 'owner' then
    raise exception using
      errcode = '42501',
      message = 'master_member_is_immutable';
  end if;

  if target_member.status = 'removed' then
    raise exception using
      errcode = '55000',
      message = 'removed_member_cannot_be_updated';
  end if;

  if normalized_role not in (
    'admin',
    'manager',
    'marketer',
    'cs',
    'designer',
    'viewer'
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_role';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_brand_ids, array[]::uuid[])) as requested(brand_id)
    left join public.brands as brand on brand.id = requested.brand_id
    where brand.id is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_brand';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_module_keys, array[]::text[])) as requested(module_key)
    where requested.module_key not in (
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
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_module';
  end if;

  update public.workspace_members
  set
    full_name = nullif(btrim(coalesce(p_full_name, '')), ''),
    workspace_role = normalized_role,
    permissions_updated_at = changed_at,
    updated_at = changed_at
  where id = p_member_id;

  delete from public.workspace_member_brand_access
  where member_id = p_member_id;

  insert into public.workspace_member_brand_access (
    member_id,
    brand_id,
    status,
    created_at,
    updated_at
  )
  select
    p_member_id,
    requested.brand_id,
    'active',
    changed_at,
    changed_at
  from (
    select distinct brand_id
    from unnest(coalesce(p_brand_ids, array[]::uuid[])) as input(brand_id)
  ) as requested;

  delete from public.workspace_member_module_permissions
  where member_id = p_member_id;

  insert into public.workspace_member_module_permissions (
    member_id,
    module_key,
    can_access,
    created_at,
    updated_at
  )
  select
    p_member_id,
    requested.module_key,
    true,
    changed_at,
    changed_at
  from (
    select distinct module_key
    from unnest(coalesce(p_module_keys, array[]::text[])) as input(module_key)
  ) as requested;
end;
$$;

create or replace function public.set_workspace_member_status(
  p_member_id uuid,
  p_requested_status text
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  target_member public.workspace_members%rowtype;
  normalized_status text := lower(btrim(coalesce(p_requested_status, '')));
  next_status text;
  access_status text;
  changed_at timestamptz := now();
begin
  select *
  into target_member
  from public.workspace_members
  where id = p_member_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'workspace_member_not_found';
  end if;

  if target_member.is_master or target_member.workspace_role = 'owner' then
    raise exception using
      errcode = '42501',
      message = 'master_member_is_immutable';
  end if;

  if target_member.status = 'removed' then
    raise exception using
      errcode = '55000',
      message = 'removed_member_cannot_be_reactivated';
  end if;

  if normalized_status not in ('active', 'suspended', 'removed') then
    raise exception using
      errcode = '22023',
      message = 'invalid_member_status';
  end if;

  next_status := case
    when normalized_status = 'active'
      and target_member.invite_accepted_at is null
      then 'invited'
    else normalized_status
  end;

  access_status := case
    when next_status = 'removed' then 'removed'
    when next_status = 'suspended' then 'suspended'
    else 'active'
  end;

  update public.workspace_members
  set
    status = next_status,
    invite_delivery_status = case
      when next_status = 'removed' then 'suppressed'
      else invite_delivery_status
    end,
    updated_at = changed_at
  where id = p_member_id;

  update public.workspace_member_brand_access
  set
    status = access_status,
    updated_at = changed_at
  where member_id = p_member_id;

  return next_status;
end;
$$;

revoke all on function public.create_workspace_member_invitation(
  text,
  text,
  text,
  uuid[],
  text[],
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.create_workspace_member_invitation(
  text,
  text,
  text,
  uuid[],
  text[],
  uuid,
  text
) to service_role;

revoke all on function public.update_workspace_member_access(
  uuid,
  text,
  text,
  uuid[],
  text[]
) from public, anon, authenticated;
grant execute on function public.update_workspace_member_access(
  uuid,
  text,
  text,
  uuid[],
  text[]
) to service_role;

revoke all on function public.set_workspace_member_status(
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.set_workspace_member_status(
  uuid,
  text
) to service_role;
