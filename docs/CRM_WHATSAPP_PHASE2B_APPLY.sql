-- CRM WhatsApp Phase 2B review/apply script.
--
-- Adds conversation/inbox state, template sync metadata, message linkage,
-- connection health timestamps, and wider message-type support.
--
-- Safety:
-- - No leads, CRM cases, forms, messages, or existing WhatsApp data are deleted.
-- - RLS remains enabled and no anon/public policies are created.
-- - Replace the final rollback with commit only after review in Supabase.

begin;

create extension if not exists pgcrypto;

alter table public.whatsapp_connections
  add column if not exists last_webhook_at timestamptz null,
  add column if not exists last_inbound_at timestamptz null,
  add column if not exists last_outbound_at timestamptz null,
  add column if not exists last_template_sync_at timestamptz null;

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  lead_id uuid null references public.leads(id) on delete set null,
  customer_phone text not null,
  customer_name text null,
  status text not null default 'active',
  unread_count integer not null default 0,
  last_inbound_at timestamptz null,
  last_outbound_at timestamptz null,
  last_message_at timestamptz null,
  last_message_preview text null,
  service_window_expires_at timestamptz null,
  assigned_user_id uuid null,
  linked_at timestamptz null,
  linked_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_conversations_status_check
    check (status in ('active', 'archived')),
  constraint whatsapp_conversations_unread_check
    check (unread_count >= 0)
);

create unique index if not exists whatsapp_conversations_connection_phone_unique
  on public.whatsapp_conversations (connection_id, customer_phone);

create index if not exists whatsapp_conversations_inbox_idx
  on public.whatsapp_conversations (brand_id, unread_count desc, last_message_at desc);

create index if not exists whatsapp_conversations_unmatched_idx
  on public.whatsapp_conversations (brand_id, last_message_at desc)
  where lead_id is null and status = 'active';

create index if not exists whatsapp_conversations_lead_idx
  on public.whatsapp_conversations (lead_id, last_message_at desc)
  where lead_id is not null;

alter table public.whatsapp_conversations enable row level security;

comment on table public.whatsapp_conversations is
  'Brand-scoped WhatsApp inbox conversation state. Service-role/admin access only; no anon/public policies.';

alter table public.whatsapp_messages
  add column if not exists conversation_id uuid null references public.whatsapp_conversations(id) on delete set null;

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, created_at asc);

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_type_check;

alter table public.whatsapp_messages
  add constraint whatsapp_messages_type_check
  check (message_type in (
    'text', 'image', 'document', 'audio', 'video', 'interactive',
    'location', 'contacts', 'template', 'system', 'unknown'
  ));

alter table public.whatsapp_templates
  add column if not exists provider_template_id text null,
  add column if not exists is_stale boolean not null default false,
  add column if not exists last_synced_at timestamptz null;

create unique index if not exists whatsapp_templates_connection_name_language_unique
  on public.whatsapp_templates (connection_id, template_name, language_code)
  where connection_id is not null;

create index if not exists whatsapp_templates_status_idx
  on public.whatsapp_templates (brand_id, status, updated_at desc);

create or replace function public.set_whatsapp_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger set_whatsapp_conversations_updated_at
before update on public.whatsapp_conversations
for each row
execute function public.set_whatsapp_conversation_updated_at();

-- Safe backfill: derive one conversation per connection/customer phone and attach
-- existing messages. Existing lead links are preserved.
insert into public.whatsapp_conversations (
  brand_id,
  connection_id,
  lead_id,
  customer_phone,
  status,
  unread_count,
  last_inbound_at,
  last_outbound_at,
  last_message_at,
  last_message_preview,
  service_window_expires_at
)
select distinct on (m.connection_id, customer_phone)
  m.brand_id,
  m.connection_id,
  m.lead_id,
  customer_phone,
  'active',
  0,
  max(m.created_at) filter (where m.direction = 'inbound') over (
    partition by m.connection_id, customer_phone
  ),
  max(m.created_at) filter (where m.direction = 'outbound') over (
    partition by m.connection_id, customer_phone
  ),
  max(m.created_at) over (partition by m.connection_id, customer_phone),
  first_value(left(coalesce(m.body, '[' || coalesce(m.message_type, 'message') || ']'), 240)) over (
    partition by m.connection_id, customer_phone order by m.created_at desc
  ),
  (
    max(m.created_at) filter (where m.direction = 'inbound') over (
      partition by m.connection_id, customer_phone
    ) + interval '24 hours'
  )
from (
  select
    wm.*,
    case
      when wm.direction = 'inbound' then nullif(wm.from_phone, '')
      else nullif(wm.to_phone, '')
    end as customer_phone
  from public.whatsapp_messages wm
  where wm.connection_id is not null
) m
where customer_phone is not null
on conflict (connection_id, customer_phone) do nothing;

update public.whatsapp_messages m
set conversation_id = c.id
from public.whatsapp_conversations c
where m.conversation_id is null
  and m.connection_id = c.connection_id
  and c.customer_phone = case
    when m.direction = 'inbound' then m.from_phone
    else m.to_phone
  end;

-- Verification.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'whatsapp_connections',
    'whatsapp_conversations',
    'whatsapp_messages',
    'whatsapp_message_events',
    'whatsapp_templates'
  )
order by table_name;

select schemaname, tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename like 'whatsapp_%'
order by tablename, indexname;

rollback;
