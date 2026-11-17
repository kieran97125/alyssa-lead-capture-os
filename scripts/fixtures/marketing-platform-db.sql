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
insert into public.workspace_members(workspace_role,is_master) values('owner',true),('manager',false),('marketer',false);
insert into public.brands(name) values('Existing brand A'),('Existing brand B');
