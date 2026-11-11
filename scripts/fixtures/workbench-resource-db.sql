-- Isolated CI prerequisites only. Never a production migration.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create table public.personal_workbenches(owner_member_id uuid primary key,created_at timestamptz not null default now());
insert into public.personal_workbenches(owner_member_id) values(gen_random_uuid());
