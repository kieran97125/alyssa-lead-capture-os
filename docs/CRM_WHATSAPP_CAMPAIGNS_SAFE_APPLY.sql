-- Alyssa CRM / Kairvo
-- WhatsApp Broadcast Operations — consent-gated execution layer
-- GrowthRadar owns audience strategy and performance analysis.
-- CRM owns safe execution, delivery state, opt-out and audit.
--
-- Safety contract:
-- 1. No outbound promotional template without explicit brand-scoped consent evidence.
-- 2. Active suppressions always win over consent.
-- 3. Only approved, non-stale Meta templates may be used.
-- 4. Recipients are materialized before approval and sending.
-- 5. Queue claims are atomic, idempotent and recover stale workers.
-- 6. Browser clients receive no direct table grants.

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_contact_consents (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  contact_id uuid null references public.contacts(id) on delete set null,
  normalized_phone text not null,
  consent_status text not null default 'granted'
    check (consent_status in ('granted', 'revoked', 'unknown')),
  consent_categories jsonb not null default '["marketing"]'::jsonb,
  consent_source text not null,
  consent_text_version text null,
  evidence_note text null,
  evidence_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  revoked_at timestamptz null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, normalized_phone)
);

create table if not exists public.whatsapp_suppressions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  contact_id uuid null references public.contacts(id) on delete set null,
  normalized_phone text not null,
  active boolean not null default true,
  reason text not null,
  source text not null,
  evidence_payload jsonb not null default '{}'::jsonb,
  suppressed_at timestamptz not null default now(),
  released_at timestamptz null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, normalized_phone)
);

create table if not exists public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete restrict,
  template_id uuid not null references public.whatsapp_templates(id) on delete restrict,
  name text not null,
  status text not null default 'draft'
    check (status in (
      'draft',
      'dry_run_ready',
      'approved',
      'queued',
      'sending',
      'paused',
      'completed',
      'cancelled',
      'failed'
    )),
  audience_definition jsonb not null default '{}'::jsonb,
  frequency_cap_days integer not null default 30
    check (frequency_cap_days between 1 and 365),
  requires_approval boolean not null default true,
  eligible_count integer not null default 0,
  excluded_count integer not null default 0,
  queued_count integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  read_count integer not null default 0,
  failed_count integer not null default 0,
  opt_out_count integer not null default 0,
  approved_by text null,
  approved_at timestamptz null,
  scheduled_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  paused_at timestamptz null,
  last_error text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  contact_id uuid null references public.contacts(id) on delete set null,
  lead_id uuid null references public.leads(id) on delete set null,
  normalized_phone text not null,
  customer_name text null,
  template_variables jsonb not null default '[]'::jsonb,
  eligibility_status text not null default 'eligible'
    check (eligibility_status in ('eligible', 'excluded')),
  exclusion_reason text null,
  send_status text not null default 'pending'
    check (send_status in (
      'pending',
      'queued',
      'claimed',
      'sent',
      'delivered',
      'read',
      'failed',
      'skipped',
      'opted_out'
    )),
  idempotency_key text not null,
  claim_token text null,
  claimed_at timestamptz null,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz null,
  provider_message_id text null,
  last_error_code text null,
  last_error_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  read_at timestamptz null,
  failed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, normalized_phone),
  unique (idempotency_key)
);

create table if not exists public.whatsapp_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  recipient_id uuid null references public.whatsapp_campaign_recipients(id) on delete cascade,
  event_type text not null,
  actor text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_contact_consents_brand_phone_idx
  on public.whatsapp_contact_consents (brand_id, normalized_phone);
create index if not exists whatsapp_suppressions_active_idx
  on public.whatsapp_suppressions (brand_id, normalized_phone)
  where active = true;
create index if not exists whatsapp_campaigns_brand_status_idx
  on public.whatsapp_campaigns (brand_id, status, created_at desc);
create index if not exists whatsapp_campaign_recipients_queue_idx
  on public.whatsapp_campaign_recipients (campaign_id, send_status, next_attempt_at, created_at);
create index if not exists whatsapp_campaign_recipients_provider_idx
  on public.whatsapp_campaign_recipients (provider_message_id)
  where provider_message_id is not null;
create index if not exists whatsapp_campaign_events_campaign_idx
  on public.whatsapp_campaign_events (campaign_id, created_at desc);

alter table public.whatsapp_contact_consents enable row level security;
alter table public.whatsapp_suppressions enable row level security;
alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_campaign_recipients enable row level security;
alter table public.whatsapp_campaign_events enable row level security;

revoke all on public.whatsapp_contact_consents from anon, authenticated;
revoke all on public.whatsapp_suppressions from anon, authenticated;
revoke all on public.whatsapp_campaigns from anon, authenticated;
revoke all on public.whatsapp_campaign_recipients from anon, authenticated;
revoke all on public.whatsapp_campaign_events from anon, authenticated;

grant all on public.whatsapp_contact_consents to service_role;
grant all on public.whatsapp_suppressions to service_role;
grant all on public.whatsapp_campaigns to service_role;
grant all on public.whatsapp_campaign_recipients to service_role;
grant all on public.whatsapp_campaign_events to service_role;

create or replace function public.claim_whatsapp_campaign_recipients(
  p_campaign_id uuid,
  p_limit integer,
  p_claim_token text
)
returns table (
  id uuid,
  campaign_id uuid,
  brand_id uuid,
  contact_id uuid,
  lead_id uuid,
  normalized_phone text,
  customer_name text,
  template_variables jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'invalid_batch_limit';
  end if;

  if p_claim_token is null or length(trim(p_claim_token)) < 8 then
    raise exception 'invalid_claim_token';
  end if;

  if not exists (
    select 1
    from public.whatsapp_campaigns c
    where c.id = p_campaign_id
      and c.status in ('queued', 'sending')
  ) then
    raise exception 'campaign_not_sendable';
  end if;

  return query
  with candidates as (
    select r.id
    from public.whatsapp_campaign_recipients r
    where r.campaign_id = p_campaign_id
      and r.eligibility_status = 'eligible'
      and (
        r.send_status in ('pending', 'queued')
        or (
          r.send_status = 'claimed'
          and r.claimed_at < now() - interval '15 minutes'
        )
      )
      and (r.next_attempt_at is null or r.next_attempt_at <= now())
    order by r.created_at asc
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.whatsapp_campaign_recipients r
    set send_status = 'claimed',
        claim_token = p_claim_token,
        claimed_at = now(),
        attempt_count = r.attempt_count + 1,
        updated_at = now()
    from candidates c
    where r.id = c.id
    returning r.*
  )
  select
    claimed.id,
    claimed.campaign_id,
    claimed.brand_id,
    claimed.contact_id,
    claimed.lead_id,
    claimed.normalized_phone,
    claimed.customer_name,
    claimed.template_variables,
    claimed.attempt_count
  from claimed;
end;
$$;

revoke all on function public.claim_whatsapp_campaign_recipients(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_campaign_recipients(uuid, integer, text)
  to service_role;
