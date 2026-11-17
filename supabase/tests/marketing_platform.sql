\set ON_ERROR_STOP on
begin;
do $$
declare w uuid; owner_id uuid; support_id uuid; customer_id uuid; created_id uuid; subject_id uuid; foreign_subject uuid;
begin
  select id into strict w from public.marketing_workspaces where is_legacy_customer;
  if (select count(*) from public.brands where workspace_id=w)<>2 or (select count(*) from public.workspace_members where workspace_id=w)<>3 then raise exception 'Existing customer membership was not preserved'; end if;
  if exists(select 1 from public.workspace_members where is_master) then raise exception 'Legacy owner retained platform-style master flag'; end if;
  if not exists(select 1 from public.workspace_members where workspace_role='owner') then raise exception 'Customer owner role lost'; end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('marketing_workspaces','marketing_platform_operators','marketing_platform_audit','marketing_system_cards','marketing_login_link_requests') and not c.relrowsecurity) then raise exception 'Control-plane RLS missing'; end if;
  if has_table_privilege('anon','public.marketing_platform_operators','select') or has_table_privilege('authenticated','public.marketing_workspaces','select') or has_function_privilege('authenticated','public.provision_marketing_workspace(uuid,text,text)','execute') then raise exception 'Browser role gained platform authority'; end if;
  if not has_table_privilege('service_role','public.marketing_platform_audit','SELECT') or not has_table_privilege('service_role','public.marketing_platform_audit','INSERT') then raise exception 'Audit read/append missing'; end if;
  if has_table_privilege('service_role','public.marketing_platform_audit','UPDATE') or has_table_privilege('service_role','public.marketing_platform_audit','DELETE') or has_table_privilege('service_role','public.marketing_platform_audit','TRUNCATE') or has_table_privilege('service_role','public.marketing_platform_audit','TRIGGER') or has_table_privilege('service_role','public.marketing_platform_audit','REFERENCES') then raise exception 'Audit has inherited mutation privileges'; end if;
  insert into public.marketing_platform_operators(email,role) values('platform-owner@example.test','owner') returning id into owner_id;
  insert into public.marketing_platform_operators(email,role) values('support@example.test','support') returning id into support_id;
  insert into auth.users(email) values('platform-owner@example.test') returning id into subject_id;
  insert into auth.users(email) values('foreign@example.test') returning id into foreign_subject;
  if not public.bind_marketing_platform_operator(owner_id,subject_id,'platform-owner@example.test') or not public.bind_marketing_platform_operator(owner_id,subject_id,'platform-owner@example.test') then raise exception 'Verified operator binding or repeat failed'; end if;
  if public.bind_marketing_platform_operator(owner_id,foreign_subject,'platform-owner@example.test') then raise exception 'Foreign subject replaced operator binding'; end if;
  if (select count(*) from public.marketing_platform_audit where operator_id=owner_id and event_key='platform.identity_bound')<>1 then raise exception 'Identity binding audit duplicated'; end if;
  select id into customer_id from public.workspace_members limit 1;
  begin perform public.provision_marketing_workspace(customer_id,'forbidden-customer','Forbidden'); raise exception 'Customer was promoted to platform operator'; exception when insufficient_privilege then null; end;
  begin perform public.provision_marketing_workspace(support_id,'forbidden-support','Forbidden'); raise exception 'Support provisioned a customer'; exception when insufficient_privilege then null; end;
  created_id:=public.provision_marketing_workspace(owner_id,'fixture-customer','Fixture Customer');
  if not exists(select 1 from public.marketing_workspaces where id=created_id and status='provisioning' and isolation_status='pending' and not is_legacy_customer) then raise exception 'New customer was opened before qualification'; end if;
  if not exists(select 1 from public.marketing_platform_audit where workspace_id=created_id and operator_id=owner_id and event_key='workspace.provisioned') then raise exception 'Provisioning audit missing'; end if;
  begin update public.marketing_workspaces set status='active' where id=created_id; raise exception 'Unqualified customer became active'; exception when check_violation then null; end;
  begin perform public.provision_marketing_workspace(owner_id,'fixture-customer','Duplicate'); raise exception 'Duplicate customer accepted'; exception when unique_violation then null; end;
  if (select count(*) from public.marketing_platform_audit where workspace_id=created_id)<>1 then raise exception 'Failed duplicate wrote an audit'; end if;
  if not public.claim_marketing_login_link(repeat('a',64),repeat('b',64)) then raise exception 'First login link denied'; end if;
  if public.claim_marketing_login_link(repeat('a',64),repeat('b',64)) then raise exception 'Login link replay bypassed cooldown'; end if;
  if public.claim_marketing_login_link('invalid',repeat('b',64)) then raise exception 'Malformed throttle identity accepted'; end if;
  if (select count(*) from public.marketing_system_cards)<>4 then raise exception 'Unfinished work has no system cards'; end if;
end $$;
set local role authenticated;
do $$ begin
  begin perform count(*) from public.marketing_workspaces; raise exception 'Customer read platform registry'; exception when insufficient_privilege then null; end;
  begin perform public.claim_marketing_login_link(repeat('c',64),repeat('d',64)); raise exception 'Customer called privileged login RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo 'PASS: customer preservation, separate platform authority, closed admission, atomic provisioning/audit, private metadata and login throttle'
