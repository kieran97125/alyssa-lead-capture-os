-- The canvas is a versioned document, not a duplicate of shared CRM/Jobs.
-- Only server routes verified against the configured owner may access it.
create table public.personal_workbenches (
  owner_member_id uuid primary key references public.workspace_members(id) on delete restrict,
  document jsonb not null check (jsonb_typeof(document) = 'object' and document->>'schemaVersion' = '1'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint personal_workbench_size check (octet_length(document::text) <= 1200000)
);
alter table public.personal_workbenches enable row level security;
revoke all on table public.personal_workbenches from public, anon, authenticated;
grant select, insert, update on table public.personal_workbenches to service_role;
comment on table public.personal_workbenches is 'Owner-scoped private work graph. Service-only, accessed through signed owner/Master routes; no browser Data API grants.';
