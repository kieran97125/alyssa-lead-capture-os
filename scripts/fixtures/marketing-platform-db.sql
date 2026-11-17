create extension if not exists pgcrypto;
create schema auth;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- Match managed Supabase defaults so tests catch inherited destructive grants.
alter default privileges in schema public grant all on tables to service_role;
create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create table public.workspace_members(id uuid primary key default gen_random_uuid(), workspace_role text not null, is_master boolean not null default false);
create table public.brands(id uuid primary key default gen_random_uuid(), name text not null);
create table public.workspace_member_brand_access(
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  role_override text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(member_id,brand_id)
);
alter table public.workspace_member_brand_access enable row level security;
revoke all on public.workspace_member_brand_access from anon,authenticated;
insert into public.workspace_members(workspace_role,is_master) values('owner',true),('manager',false),('marketer',false);
insert into public.brands(name) values('Existing brand A'),('Existing brand B');
insert into public.workspace_member_brand_access(member_id,brand_id)
select m.id,b.id from public.workspace_members m cross join public.brands b where m.workspace_role='manager';
