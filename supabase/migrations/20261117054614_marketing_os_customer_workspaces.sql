-- Marketing OS control-plane foundation. Existing data stays in its customer
-- workspace. Additional customers remain provisioning until isolation qualifies.
create table public.marketing_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  status text not null default 'provisioning' check (status in ('provisioning','active','suspended','archived')),
  plan_key text not null default 'enterprise',
  is_legacy_customer boolean not null default false,
  isolation_status text not null default 'pending' check (isolation_status in ('pending','qualified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_workspace_admission check (status <> 'active' or is_legacy_customer or isolation_status = 'qualified')
);
create unique index marketing_workspaces_one_legacy_customer on public.marketing_workspaces(is_legacy_customer) where is_legacy_customer;
insert into public.marketing_workspaces(slug,display_name,status,is_legacy_customer)
values ('alyssa','Alyssa Group','active',true);

create function public.marketing_legacy_workspace_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.marketing_workspaces where is_legacy_customer = true
$$;
revoke all on function public.marketing_legacy_workspace_id() from public, anon, authenticated;
grant execute on function public.marketing_legacy_workspace_id() to service_role;

alter table public.workspace_members add column workspace_id uuid not null default public.marketing_legacy_workspace_id()
  references public.marketing_workspaces(id) on delete restrict;
alter table public.brands add column workspace_id uuid not null default public.marketing_legacy_workspace_id()
  references public.marketing_workspaces(id) on delete restrict;
create index workspace_members_workspace_id_idx on public.workspace_members(workspace_id);
create index brands_workspace_id_idx on public.brands(workspace_id);

-- Legacy "master" remains a customer-workspace management compatibility flag.
-- Platform authority is a separate verified-identity registry below.
update public.workspace_members set is_master = false where workspace_role = 'owner';

create table public.marketing_platform_operators (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  email text not null check (email = lower(btrim(email)) and email like '%@%'),
  role text not null check (role in ('owner','admin','support')),
  status text not null default 'active' check (status in ('active','suspended','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index marketing_platform_operator_email_idx on public.marketing_platform_operators(lower(email));

create table public.marketing_login_link_requests (
  id bigint generated always as identity primary key,
  email_hash text not null check(email_hash ~ '^[a-f0-9]{64}$'),
  ip_hash text not null check(ip_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index marketing_login_link_email_created_idx on public.marketing_login_link_requests(email_hash,created_at desc);
create index marketing_login_link_ip_created_idx on public.marketing_login_link_requests(ip_hash,created_at desc);
alter table public.marketing_login_link_requests enable row level security;
revoke all on public.marketing_login_link_requests from anon,authenticated;
grant select,insert,delete on public.marketing_login_link_requests to service_role;
grant usage,select on sequence public.marketing_login_link_requests_id_seq to service_role;
create function public.claim_marketing_login_link(p_email_hash text,p_ip_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('login-ip:'||p_ip_hash,0));
  perform pg_advisory_xact_lock(hashtextextended('login-email:'||p_email_hash,0));
  if exists(select 1 from public.marketing_login_link_requests where email_hash=p_email_hash and created_at>now()-interval '60 seconds') or
    (select count(*) from public.marketing_login_link_requests where email_hash=p_email_hash and created_at>now()-interval '1 hour')>=5 or
    (select count(*) from public.marketing_login_link_requests where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=20 then return false; end if;
  insert into public.marketing_login_link_requests(email_hash,ip_hash) values(p_email_hash,p_ip_hash);
  return true;
end $$;
revoke all on function public.claim_marketing_login_link(text,text) from public,anon,authenticated;
grant execute on function public.claim_marketing_login_link(text,text) to service_role;

create table public.marketing_platform_audit (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid references public.marketing_platform_operators(id) on delete restrict,
  workspace_id uuid references public.marketing_workspaces(id) on delete restrict,
  event_key text not null,
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index marketing_platform_audit_workspace_created_idx on public.marketing_platform_audit(workspace_id,created_at desc);
create index marketing_platform_audit_operator_idx on public.marketing_platform_audit(operator_id);

create function public.bind_marketing_platform_operator(p_operator_id uuid,p_auth_user_id uuid,p_email text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  if p_auth_user_id is null or p_email is null then return false; end if;
  update public.marketing_platform_operators set auth_user_id=p_auth_user_id,updated_at=now()
    where id=p_operator_id and email=p_email and status='active' and auth_user_id is null;
  get diagnostics v_count=row_count;
  if v_count=1 then
    insert into public.marketing_platform_audit(operator_id,event_key) values(p_operator_id,'platform.identity_bound');
    return true;
  end if;
  return exists(select 1 from public.marketing_platform_operators where id=p_operator_id and email=p_email and status='active' and auth_user_id=p_auth_user_id);
end $$;
revoke all on function public.bind_marketing_platform_operator(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.bind_marketing_platform_operator(uuid,uuid,text) to service_role;

create table public.marketing_system_cards (
  key text primary key,
  title text not null,
  state text not null check (state in ('planned','in_progress','blocked','verified')),
  acceptance text not null,
  evidence jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.marketing_system_cards(key,title,state,acceptance) values
 ('MKT-TENANCY','完整客戶資料隔離','in_progress','所有客戶資料、RPC、公開表格、背景工作、快取及連線均有明確工作區；跨客戶讀寫測試通過後才可啟用新客戶。'),
 ('MKT-ONBOARDING','新客戶開通與成員管理','in_progress','平台與客戶權限分離；工作區開通、邀請、角色、停用及審計均有實際驗收。'),
 ('MKT-OMNICHAT','Omnichat 自動收集 Lead','blocked','核實帳戶開放方案、事件與簽署格式；通過去重、重試、亂序、來源歸因及真實預約驗收。'),
 ('MKT-DOMAIN','SmartVolt 平台網址與登入電郵','planned','中性平台網址、DNS、憑證、登入與 OAuth 回調通過；現有客戶表格及廣告連結持續可用。');

alter table public.marketing_workspaces enable row level security;
alter table public.marketing_platform_operators enable row level security;
alter table public.marketing_platform_audit enable row level security;
alter table public.marketing_system_cards enable row level security;
revoke all on public.marketing_workspaces,public.marketing_platform_operators,public.marketing_platform_audit,public.marketing_system_cards from anon,authenticated;
grant select,insert,update,delete on public.marketing_workspaces,public.marketing_platform_operators,public.marketing_system_cards to service_role;
grant select,insert on public.marketing_platform_audit to service_role;
revoke update,delete on public.marketing_platform_audit from service_role;

create function public.provision_marketing_workspace(p_operator_id uuid,p_slug text,p_display_name text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.marketing_platform_operators where id=p_operator_id and status='active' and role in ('owner','admin')) then
    raise exception 'Platform operator required' using errcode='42501';
  end if;
  insert into public.marketing_workspaces(slug,display_name) values(lower(btrim(p_slug)),btrim(p_display_name)) returning id into v_id;
  insert into public.marketing_platform_audit(operator_id,workspace_id,event_key) values(p_operator_id,v_id,'workspace.provisioned');
  return v_id;
end $$;
revoke all on function public.provision_marketing_workspace(uuid,text,text) from public,anon,authenticated;
grant execute on function public.provision_marketing_workspace(uuid,text,text) to service_role;

comment on table public.marketing_workspaces is 'Marketing OS customer registry. Product publisher is separate; existing client data is not transferred or relabeled as platform data.';
comment on table public.marketing_platform_operators is 'Platform authority. Customer owner/master flags never imply platform authority. Reserved email must match a verified Supabase identity.';
