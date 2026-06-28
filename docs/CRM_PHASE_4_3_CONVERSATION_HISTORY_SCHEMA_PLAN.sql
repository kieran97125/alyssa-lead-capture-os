begin;

-- CRM Phase 4.3 Conversation History Schema Plan
-- Proposal only. Do not execute until reviewed and explicitly approved.
--
-- Purpose:
-- - Prepare future WhatsApp conversation sync and outbound sending.
-- - Keep current CRM behavior unchanged.
-- - Do not connect WhatsApp API.
-- - Do not send messages.
-- - Do not alter public lead submission, Google Sheets sync, Pixel, consent, or form behavior.
--
-- Apply checklist before any future migration:
-- 1. Confirm existing table names and primary keys for leads, crm_contacts, and crm_lead_cases.
-- 2. Confirm service-role/admin-only mutation boundary.
-- 3. Confirm RLS is enabled and no anon/public mutation policies are added.
-- 4. Confirm WhatsApp provider and webhook signature verification design.
-- 5. Confirm consent/privacy review for storing message content.
-- 6. Confirm backup/rollback plan.
-- 7. Confirm UI still works if conversation tables are empty.

-- =========================================================
-- 1) Conversation threads
-- =========================================================

create table if not exists public.crm_conversation_threads (
  id uuid primary key default gen_random_uuid(),
  case_id uuid null references public.crm_lead_cases(id) on delete set null,
  contact_id uuid null references public.crm_contacts(id) on delete set null,
  source_lead_id uuid null references public.leads(id) on delete set null,
  brand_id uuid null references public.brands(id) on delete set null,
  brand_slug text null,
  channel text not null default 'whatsapp',
  platform text not null default 'whatsapp',
  external_thread_id text null,
  participant_phone text null,
  assigned_to text null,
  status text not null default 'open',
  last_message_at timestamptz null,
  last_inbound_at timestamptz null,
  last_outbound_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_conversation_threads_channel_check
    check (channel in ('whatsapp', 'phone', 'email', 'instagram', 'other')),
  constraint crm_conversation_threads_status_check
    check (status in ('open', 'pending_customer', 'pending_cs', 'closed', 'archived'))
);

comment on table public.crm_conversation_threads is
  'Future CRM conversation thread model for WhatsApp-style communication. Proposal only in Phase 4.3.';

create index if not exists idx_crm_conversation_threads_case
  on public.crm_conversation_threads(case_id);

create index if not exists idx_crm_conversation_threads_contact
  on public.crm_conversation_threads(contact_id);

create index if not exists idx_crm_conversation_threads_source_lead
  on public.crm_conversation_threads(source_lead_id);

create index if not exists idx_crm_conversation_threads_brand_status
  on public.crm_conversation_threads(brand_slug, status);

create unique index if not exists uq_crm_conversation_threads_external
  on public.crm_conversation_threads(platform, external_thread_id)
  where external_thread_id is not null;

-- =========================================================
-- 2) Conversation messages
-- =========================================================

create table if not exists public.crm_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.crm_conversation_threads(id) on delete cascade,
  case_id uuid null references public.crm_lead_cases(id) on delete set null,
  contact_id uuid null references public.crm_contacts(id) on delete set null,
  source_lead_id uuid null references public.leads(id) on delete set null,
  direction text not null,
  source_type text not null,
  platform text not null default 'whatsapp',
  external_message_id text null,
  client_message_id text null,
  message_status text not null default 'draft',
  body text null,
  media_json jsonb not null default '[]'::jsonb,
  quick_reply_key text null,
  ai_draft_key text null,
  draft_id uuid null,
  sent_by text null,
  assigned_to text null,
  queued_at timestamptz null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  failed_at timestamptz null,
  retry_count integer not null default 0,
  max_retries integer not null default 3,
  last_attempt_at timestamptz null,
  next_retry_at timestamptz null,
  last_error text null,
  payload_preview_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_conversation_messages_direction_check
    check (direction in ('inbound', 'outbound', 'internal')),
  constraint crm_conversation_messages_source_type_check
    check (source_type in ('whatsapp_webhook', 'whatsapp_api', 'manual_log', 'composer_draft', 'system')),
  constraint crm_conversation_messages_status_check
    check (message_status in ('draft', 'queued', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  constraint crm_conversation_messages_retry_check
    check (retry_count >= 0 and max_retries >= 0)
);

comment on table public.crm_conversation_messages is
  'Future inbound/outbound/internal conversation messages for CRM cases. Proposal only in Phase 4.3.';

create index if not exists idx_crm_conversation_messages_thread_created
  on public.crm_conversation_messages(thread_id, created_at desc);

create index if not exists idx_crm_conversation_messages_case
  on public.crm_conversation_messages(case_id);

create index if not exists idx_crm_conversation_messages_status
  on public.crm_conversation_messages(message_status, next_retry_at);

create unique index if not exists uq_crm_conversation_messages_external
  on public.crm_conversation_messages(platform, external_message_id)
  where external_message_id is not null;

create unique index if not exists uq_crm_conversation_messages_client
  on public.crm_conversation_messages(platform, client_message_id)
  where client_message_id is not null;

-- =========================================================
-- 3) Message drafts
-- =========================================================

create table if not exists public.crm_message_drafts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid null references public.crm_conversation_threads(id) on delete cascade,
  case_id uuid null references public.crm_lead_cases(id) on delete set null,
  contact_id uuid null references public.crm_contacts(id) on delete set null,
  source_lead_id uuid null references public.leads(id) on delete set null,
  draft_origin text not null default 'manual',
  quick_reply_key text null,
  ai_draft_key text null,
  body text not null,
  created_by text null,
  used_message_id uuid null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_message_drafts_origin_check
    check (draft_origin in ('quick_reply', 'ai_assist', 'manual', 'edited'))
);

comment on table public.crm_message_drafts is
  'Optional persistent composer drafts. Quick Replies and AI Assist can create drafts before human-reviewed sending.';

create index if not exists idx_crm_message_drafts_case_created
  on public.crm_message_drafts(case_id, created_at desc);

create index if not exists idx_crm_message_drafts_thread_created
  on public.crm_message_drafts(thread_id, created_at desc);

-- =========================================================
-- 4) Delivery events
-- =========================================================

create table if not exists public.crm_message_delivery_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.crm_conversation_messages(id) on delete cascade,
  platform text not null default 'whatsapp',
  event_type text not null,
  external_event_id text null,
  occurred_at timestamptz not null default now(),
  payload_hash text null,
  payload_preview_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint crm_message_delivery_events_type_check
    check (event_type in ('queued', 'sent', 'delivered', 'read', 'failed', 'cancelled'))
);

comment on table public.crm_message_delivery_events is
  'Append-only delivery/read/failure events for future WhatsApp provider callbacks.';

create index if not exists idx_crm_message_delivery_events_message
  on public.crm_message_delivery_events(message_id, occurred_at desc);

create unique index if not exists uq_crm_message_delivery_events_external
  on public.crm_message_delivery_events(platform, external_event_id)
  where external_event_id is not null;

create unique index if not exists uq_crm_message_delivery_events_hash
  on public.crm_message_delivery_events(message_id, event_type, occurred_at, payload_hash)
  where payload_hash is not null;

-- =========================================================
-- 5) RLS boundary
-- =========================================================

alter table public.crm_conversation_threads enable row level security;
alter table public.crm_conversation_messages enable row level security;
alter table public.crm_message_drafts enable row level security;
alter table public.crm_message_delivery_events enable row level security;

-- No anon/public policies are proposed here.
-- Future reads/writes should go through server-only admin/service-role code paths
-- until a reviewed internal admin auth policy exists.

-- =========================================================
-- 6) Verification queries for future manual apply
-- =========================================================

select 'crm_conversation_threads' as table_name, count(*) as row_count
from public.crm_conversation_threads
union all
select 'crm_conversation_messages', count(*)
from public.crm_conversation_messages
union all
select 'crm_message_drafts', count(*)
from public.crm_message_drafts
union all
select 'crm_message_delivery_events', count(*)
from public.crm_message_delivery_events;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'crm_conversation_threads',
    'crm_conversation_messages',
    'crm_message_drafts',
    'crm_message_delivery_events'
  )
order by tablename;

rollback;
