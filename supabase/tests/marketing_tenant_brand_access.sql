\set ON_ERROR_STOP on
begin;
do $$
declare legacy uuid; other uuid; member_a uuid; member_b uuid; brand_a uuid; brand_b uuid; grant_b uuid;
begin
  select id into strict legacy from public.marketing_workspaces where is_legacy_customer;
  if (select count(*) from public.workspace_member_brand_access) <> 2 or exists (
    select 1 from public.workspace_member_brand_access where workspace_id<>legacy
  ) then raise exception 'Existing Brand grants were not preserved'; end if;
  insert into public.marketing_workspaces(slug,display_name) values('isolated-fixture','Isolated fixture') returning id into other;
  select id into member_a from public.workspace_members where workspace_role='marketer';
  select id into brand_a from public.brands where name='Existing brand A';
  insert into public.workspace_members(workspace_role,workspace_id) values('marketer',other) returning id into member_b;
  insert into public.brands(name,workspace_id) values('Other customer Brand',other) returning id into brand_b;

  -- Legacy RPC insert shape remains compatible; an additional workspace never
  -- receives the global legacy default for its grant.
  insert into public.workspace_member_brand_access(member_id,brand_id) values(member_a,brand_a);
  insert into public.workspace_member_brand_access(member_id,brand_id) values(member_b,brand_b) returning id into grant_b;
  if not exists(select 1 from public.workspace_member_brand_access where id=grant_b and workspace_id=other) then raise exception 'Grant did not derive actual customer'; end if;
  begin insert into public.workspace_member_brand_access(member_id,brand_id) values(member_a,brand_b);
    raise exception 'Cross-customer Brand accepted'; exception when foreign_key_violation then null; end;
  begin insert into public.workspace_member_brand_access(member_id,brand_id) values(member_b,brand_a);
    raise exception 'Reverse cross-customer Brand accepted'; exception when foreign_key_violation then null; end;
  begin insert into public.workspace_member_brand_access(member_id,brand_id,workspace_id) values(member_a,brand_b,other);
    raise exception 'Forged customer scope accepted'; exception when foreign_key_violation then null; end;
  begin update public.workspace_member_brand_access set brand_id=brand_a where id=grant_b;
    raise exception 'Existing grant moved across customers'; exception when foreign_key_violation then null; end;
  begin update public.workspace_member_brand_access set workspace_id=legacy where id=grant_b;
    raise exception 'Existing grant ownership relabeled'; exception when foreign_key_violation then null; end;
  begin update public.brands set workspace_id=legacy where id=brand_b;
    raise exception 'Referenced Brand moved across customers'; exception when foreign_key_violation then null; end;
  begin update public.workspace_members set workspace_id=legacy where id=member_b;
    raise exception 'Referenced member moved across customers'; exception when foreign_key_violation then null; end;
  update public.workspace_member_brand_access set status='suspended',role_override='viewer' where id=grant_b;
  if not exists(select 1 from public.workspace_member_brand_access where id=grant_b and workspace_id=other and status='suspended') then raise exception 'Ordinary permission update failed'; end if;
  if has_table_privilege('authenticated','public.workspace_member_brand_access','SELECT') or
     has_function_privilege('authenticated','public.bind_marketing_brand_access_workspace()','EXECUTE') then raise exception 'Browser gained privileged access'; end if;
  if not exists(select 1 from public.marketing_workspaces where id=other and status='provisioning' and isolation_status='pending') then raise exception 'New customer admitted'; end if;
end $$;
set local role service_role;
-- Permission RPCs run as service_role: verify trigger compatibility under that
-- role rather than only as the schema owner. No platform/client access added.
insert into public.workspace_member_brand_access(member_id,brand_id)
select m.id,b.id from public.workspace_members m cross join public.brands b
where m.workspace_role='owner' and b.name='Existing brand A';
reset role;
rollback;
\echo 'PASS: preserved grants, actual customer derivation, cross-customer insert/update/parent denial, service-role compatibility and closed admission'
