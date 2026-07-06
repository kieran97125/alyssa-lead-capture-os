-- CRM WhatsApp Connection Ready MVP review/apply script.
--
-- Apply checklist:
-- [ ] Review this file in full before running in Supabase.
-- [ ] Confirm this only creates WhatsApp connection/message tables.
-- [ ] Confirm public forms, attribution, Pixel, Sheets, CRM booking semantics,
--     forms, landing pages, and lead submission are not altered.
-- [ ] Set WHATSAPP_CREDENTIAL_ENCRYPTION_KEY before saving credentials.
-- [ ] Confirm RLS remains enabled and no anon/public policies are created.
-- [ ] Confirm CRM server code uses service-role/admin access only.
-- [ ] Replace the final rollback with commit only after review.

begin;

-- Preview existing WhatsApp tables, if any.
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'whatsapp_connections',
    'whatsapp_messages',
    'whatsapp_message_events',
    'whatsapp_templates'
  )
order by table_name;

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null default 'meta_whatsapp_cloud_api',
  status text not null default 'saved',
  waba_id text not null,
  phone_number_id text not null,
  display_phone_number text not null,
  app_id text null,
  app_secret_encrypted text null,
  access_token_encrypted text null,
  verify_token text not null,
  webhook_url text not null,
  graph_api_version text not null default 'v21.0',
  default_send_mode text not null default 'template_required_for_first_contact',
  last_verified_at timestamptz null,
  last_tested_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_connections_provider_check
    check (provider in ('meta_whatsapp_cloud_api')),
  constraint whatsapp_connections_status_check
    check (status in ('not_configured', 'saved', 'webhook_verified', 'test_succeeded', 'error')),
  constraint whatsapp_connections_send_mode_check
    check (default_send_mode in ('manual', 'template_required_for_first_contact'))
);

create unique index if not exists whatsapp_connections_brand_provider_unique
  on public.whatsapp_connections (brand_id, provider);

create unique index if not exists whatsapp_connections_phone_number_id_unique
  on public.whatsapp_connections (phone_number_id)
  where phone_number_id is not null and phone_number_id <> '';

create index if not exists whatsapp_connections_status_idx
  on public.whatsapp_connections (status, updated_at desc);

alter table public.whatsapp_connections enable row level security;

comment on table public.whatsapp_connections is
  'Brand-specific WhatsApp Cloud API connection settings. Secrets are encrypted by the application before storage. Service-role/admin access only; no anon/public policies.';

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  lead_id uuid null references public.leads(id) on delete set null,
  connection_id uuid null references public.whatsapp_connections(id) on delete set null,
  direction text not null,
  message_type text not null default 'text',
  whatsapp_message_id text null,
  from_phone text null,
  to_phone text null,
  body text null,
  template_name text null,
  status text null,
  raw_payload jsonb null,
  sent_by_user_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_messages_direction_check
    check (direction in ('inbound', 'outbound')),
  constraint whatsapp_messages_type_check
    check (message_type in ('text', 'image', 'document', 'audio', 'interactive', 'template', 'unknown'))
);

create unique index if not exists whatsapp_messages_provider_id_unique
  on public.whatsapp_messages (whatsapp_message_id)
  where whatsapp_message_id is not null and whatsapp_message_id <> '';

create index if not exists whatsapp_messages_lead_idx
  on public.whatsapp_messages (lead_id, created_at desc);

create index if not exists whatsapp_messages_connection_idx
  on public.whatsapp_messages (connection_id, created_at desc);

create index if not exists whatsapp_messages_brand_unmatched_idx
  on public.whatsapp_messages (brand_id, created_at desc)
  where lead_id is null;

alter table public.whatsapp_messages enable row level security;

comment on table public.whatsapp_messages is
  'Inbound and outbound WhatsApp messages for CRM lead detail and future inbox. Service-role/admin access only; no anon/public policies.';

create table if not exists public.whatsapp_message_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid null references public.whatsapp_messages(id) on delete set null,
  event_type text not null,
  status text null,
  raw_payload jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_message_events_message_idx
  on public.whatsapp_message_events (message_id, created_at desc);

alter table public.whatsapp_message_events enable row level security;

comment on table public.whatsapp_message_events is
  'Append-only delivery/read/failure webhook event log for WhatsApp messages.';

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  connection_id uuid null references public.whatsapp_connections(id) on delete set null,
  template_name text not null,
  language_code text not null default 'zh_HK',
  status text not null default 'planned',
  category text null,
  components jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_templates_brand_idx
  on public.whatsapp_templates (brand_id, template_name);

alter table public.whatsapp_templates enable row level security;

comment on table public.whatsapp_templates is
  'Future WhatsApp approved template registry. Not used for bulk broadcast in MVP.';

-- Keep updated_at current without requiring app-side timestamps.
create or replace function public.set_whatsapp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_whatsapp_connections_updated_at on public.whatsapp_connections;
create trigger set_whatsapp_connections_updated_at
before update on public.whatsapp_connections
for each row
execute function public.set_whatsapp_updated_at();

drop trigger if exists set_whatsapp_messages_updated_at on public.whatsapp_messages;
create trigger set_whatsapp_messages_updated_at
before update on public.whatsapp_messages
for each row
execute function public.set_whatsapp_updated_at();

drop trigger if exists set_whatsapp_templates_updated_at on public.whatsapp_templates;
create trigger set_whatsapp_templates_updated_at
before update on public.whatsapp_templates
for each row
execute function public.set_whatsapp_updated_at();

-- Post-apply verification.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'whatsapp_connections',
    'whatsapp_messages',
    'whatsapp_message_events',
    'whatsapp_templates'
  )
order by table_name;

select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'whatsapp_connections',
    'whatsapp_messages',
    'whatsapp_message_events',
    'whatsapp_templates'
  )
order by tablename, indexname;

rollback;
