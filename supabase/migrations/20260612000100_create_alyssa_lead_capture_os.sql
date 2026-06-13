create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  customer_name text null,
  phone text not null,
  normalized_phone text not null unique,
  email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text null,
  primary_color text null,
  secondary_color text null,
  whatsapp_number text null,
  default_thank_you_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  slug text not null,
  description text null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  name text not null,
  original_price numeric(12,2) null,
  promo_price numeric(12,2) null,
  currency text not null default 'HKD',
  payment_required boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  slug text not null,
  address text null,
  opening_hours jsonb null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  public_form_token text not null unique,
  brand_id uuid not null references public.brands(id) on delete cascade,
  form_name text not null,
  status text not null default 'active',
  allowed_domains text[] not null default '{}',
  default_treatment_id uuid null references public.treatments(id) on delete set null,
  default_package_id uuid null references public.packages(id) on delete set null,
  default_branch_id uuid null references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  visitor_id text null,
  session_id text null,
  contact_id uuid null references public.contacts(id) on delete set null,
  lead_id uuid null,
  first_touch_json jsonb null,
  latest_touch_json jsonb null,
  submitted_touch_json jsonb null,
  whatsapp_referral_json jsonb null,
  raw_payload_json jsonb null,
  utm_source text null,
  utm_medium text null,
  utm_campaign text null,
  utm_id text null,
  utm_content text null,
  utm_term text null,
  fbclid text null,
  gclid text null,
  ttclid text null,
  msclkid text null,
  wbraid text null,
  gbraid text null,
  referrer text null,
  landing_page_url text null,
  current_page_url text null,
  page_path text null,
  page_title text null,
  source_capture_method text null,
  attribution_quality text null,
  tracking_status text null,
  audit_reason text null,
  ctwa_id text null,
  whatsapp_message_id text null,
  whatsapp_conversation_id text null,
  whatsapp_phone_number_id text null,
  meta_ad_id text null,
  meta_adset_id text null,
  meta_campaign_id text null,
  meta_source_url text null,
  whatsapp_referral_headline text null,
  whatsapp_referral_body text null,
  whatsapp_referral_source_type text null,
  whatsapp_referral_source_id text null,
  first_seen_at timestamptz null,
  last_seen_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint lead_source_snapshots_source_type_check
    check (source_type in ('reg_form_utm', 'whatsapp_ctwa', 'organic_unknown', 'manual', 'imported')),
  constraint lead_source_snapshots_tracking_status_check
    check (tracking_status is null or tracking_status in (
      'complete_utm',
      'partial_utm',
      'click_id_only',
      'ctwa_detected',
      'referrer_only',
      'storage_recovered',
      'organic_unknown',
      'missing'
    ))
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_uid text not null unique,
  source_snapshot_id uuid null references public.lead_source_snapshots(id) on delete set null,
  source_type text not null,
  form_id uuid null references public.forms(id) on delete set null,
  brand_id uuid null references public.brands(id) on delete set null,
  treatment_id uuid null references public.treatments(id) on delete set null,
  package_id uuid null references public.packages(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  customer_name text null,
  phone text not null,
  normalized_phone text not null,
  appointment_date date null,
  appointment_time text null,
  price numeric(12,2) null,
  currency text not null default 'HKD',
  payment_status text not null default 'unpaid',
  lead_status text not null default 'new',
  booking_status text not null default 'requested',
  crm_status text null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_source_type_check
    check (source_type in ('reg_form_utm', 'whatsapp_ctwa', 'organic_unknown', 'manual', 'imported')),
  constraint leads_payment_status_check
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'cancelled', 'booking_only', 'verification_needed')),
  constraint leads_lead_status_check
    check (lead_status in ('new', 'submitted', 'booked', 'paid', 'no_show', 'cancelled', 'duplicate', 'invalid', 'lost')),
  constraint leads_booking_status_check
    check (booking_status in ('requested', 'confirmed', 'rescheduled', 'cancelled', 'show', 'no_show'))
);

alter table public.lead_source_snapshots
  add constraint lead_source_snapshots_lead_id_fk
  foreign key (lead_id) references public.leads(id) on delete set null;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  brand_id uuid null references public.brands(id) on delete set null,
  treatment_id uuid null references public.treatments(id) on delete set null,
  branch_id uuid null references public.branches(id) on delete set null,
  appointment_date date null,
  appointment_time text null,
  booking_status text not null default 'requested',
  created_by_source text not null default 'reg_form_utm',
  crm_owner_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_booking_status_check
    check (booking_status in ('requested', 'confirmed', 'rescheduled', 'cancelled', 'show', 'no_show'))
);

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete set null,
  contact_id uuid null references public.contacts(id) on delete set null,
  source_snapshot_id uuid null references public.lead_source_snapshots(id) on delete set null,
  visitor_id text null,
  session_id text null,
  event_type text not null,
  event_payload_json jsonb not null default '{}',
  page_url text null,
  referrer text null,
  created_at timestamptz not null default now(),
  constraint lead_events_event_type_check
    check (event_type in (
      'page_view',
      'parent_attribution_captured',
      'form_iframe_loaded',
      'attribution_payload_received',
      'form_view',
      'form_start',
      'form_submit_attempt',
      'form_submit_success',
      'form_submit_failed',
      'whatsapp_clicked',
      'whatsapp_inbound_received',
      'ctwa_source_detected',
      'organic_source_assigned',
      'booking_created',
      'booking_confirmed',
      'booking_rescheduled',
      'booking_cancelled',
      'payment_initiated',
      'payment_success',
      'payment_failed',
      'payment_cancelled',
      'thank_you_viewed',
      'crm_followup_started',
      'crm_followup_updated',
      'show_up',
      'no_show',
      'deal_paid',
      'deal_lost',
      'duplicate_detected'
    ))
);

create index if not exists contacts_normalized_phone_idx on public.contacts(normalized_phone);
create index if not exists leads_brand_source_created_idx on public.leads(brand_id, source_type, created_at desc);
create index if not exists leads_normalized_brand_treatment_idx on public.leads(normalized_phone, brand_id, treatment_id, created_at desc);
create index if not exists snapshots_source_tracking_created_idx on public.lead_source_snapshots(source_type, tracking_status, created_at desc);
create index if not exists snapshots_utm_campaign_idx on public.lead_source_snapshots(utm_source, utm_medium, utm_campaign);
create index if not exists snapshots_ctwa_idx on public.lead_source_snapshots(ctwa_id) where ctwa_id is not null;
create index if not exists lead_events_lead_created_idx on public.lead_events(lead_id, created_at desc);
create index if not exists bookings_lead_idx on public.bookings(lead_id);

insert into public.brands (
  id,
  name,
  slug,
  primary_color,
  secondary_color,
  whatsapp_number,
  default_thank_you_url
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Alyssa',
  'alyssa',
  '#5a2348',
  '#c9828e',
  '+85200000000',
  '/thank-you'
)
on conflict (slug) do update
set
  name = excluded.name,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  whatsapp_number = excluded.whatsapp_number,
  default_thank_you_url = excluded.default_thank_you_url,
  updated_at = now();

insert into public.treatments (
  id,
  brand_id,
  name,
  slug,
  description,
  status
)
values
  (
    '22222222-2222-4222-8222-222222222221',
    '11111111-1111-4111-8111-111111111111',
    'Skin analysis and consultation',
    'skin-renewal-consult',
    'A beauty consultant reviews skin goals and recommends the best treatment path.',
    'active'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Medical beauty trial treatment',
    'medical-beauty-trial',
    'A first-visit experience for clients who want to understand treatment options.',
    'active'
  )
on conflict (brand_id, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  updated_at = now();

insert into public.packages (
  id,
  treatment_id,
  name,
  original_price,
  promo_price,
  currency,
  payment_required,
  status
)
values
  (
    '33333333-3333-4333-8333-333333333331',
    '22222222-2222-4222-8222-222222222221',
    'Free consultation booking',
    0,
    0,
    'HKD',
    false,
    'active'
  ),
  (
    '33333333-3333-4333-8333-333333333332',
    '22222222-2222-4222-8222-222222222222',
    'First-visit trial offer',
    980,
    388,
    'HKD',
    true,
    'active'
  )
on conflict (id) do update
set
  treatment_id = excluded.treatment_id,
  name = excluded.name,
  original_price = excluded.original_price,
  promo_price = excluded.promo_price,
  currency = excluded.currency,
  payment_required = excluded.payment_required,
  status = excluded.status,
  updated_at = now();

insert into public.branches (
  id,
  brand_id,
  name,
  slug,
  address,
  status
)
values
  (
    '44444444-4444-4444-8444-444444444441',
    '11111111-1111-4111-8111-111111111111',
    'Central',
    'central',
    null,
    'active'
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '11111111-1111-4111-8111-111111111111',
    'Causeway Bay',
    'causeway-bay',
    null,
    'active'
  ),
  (
    '44444444-4444-4444-8444-444444444443',
    '11111111-1111-4111-8111-111111111111',
    'Tsim Sha Tsui',
    'tsim-sha-tsui',
    null,
    'active'
  )
on conflict (brand_id, slug) do update
set
  name = excluded.name,
  address = excluded.address,
  status = excluded.status,
  updated_at = now();

insert into public.forms (
  id,
  public_form_token,
  brand_id,
  form_name,
  status,
  allowed_domains,
  default_treatment_id,
  default_package_id,
  default_branch_id
)
values (
  '55555555-5555-4555-8555-555555555551',
  'alyssa-main-form-dev-token',
  '11111111-1111-4111-8111-111111111111',
  'Alyssa Main Registration Form',
  'active',
  array['localhost', '127.0.0.1'],
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333332',
  '44444444-4444-4444-8444-444444444441'
)
on conflict (public_form_token) do update
set
  brand_id = excluded.brand_id,
  form_name = excluded.form_name,
  status = excluded.status,
  allowed_domains = excluded.allowed_domains,
  default_treatment_id = excluded.default_treatment_id,
  default_package_id = excluded.default_package_id,
  default_branch_id = excluded.default_branch_id,
  updated_at = now();

create or replace view public.dashboard_lead_source_performance as
select
  leads.brand_id,
  leads.source_type,
  snapshots.utm_source,
  snapshots.utm_medium,
  snapshots.utm_campaign,
  snapshots.tracking_status,
  count(distinct leads.id)::bigint as lead_count,
  count(distinct leads.id) filter (where snapshots.fbclid is not null)::bigint as fbclid_count,
  count(distinct leads.id) filter (where snapshots.gclid is not null)::bigint as gclid_count,
  count(distinct leads.id) filter (where snapshots.ctwa_id is not null)::bigint as ctwa_count,
  count(distinct bookings.id) filter (where bookings.booking_status = 'requested')::bigint as booking_requested_count,
  count(distinct bookings.id) filter (where bookings.booking_status = 'confirmed')::bigint as booking_confirmed_count,
  count(distinct leads.id) filter (where leads.payment_status = 'paid')::bigint as paid_lead_count,
  coalesce(sum(leads.price) filter (where leads.payment_status = 'paid'), 0)::numeric(12,2) as paid_revenue
from public.leads
left join public.lead_source_snapshots as snapshots
  on snapshots.id = leads.source_snapshot_id
left join public.bookings
  on bookings.lead_id = leads.id
group by
  leads.brand_id,
  leads.source_type,
  snapshots.utm_source,
  snapshots.utm_medium,
  snapshots.utm_campaign,
  snapshots.tracking_status;

create or replace view public.dashboard_attribution_audit as
select
  snapshots.id as source_snapshot_id,
  snapshots.lead_id,
  snapshots.contact_id,
  snapshots.source_type,
  snapshots.attribution_quality,
  snapshots.tracking_status,
  snapshots.audit_reason,
  snapshots.utm_source,
  snapshots.utm_medium,
  snapshots.utm_campaign,
  snapshots.fbclid,
  snapshots.gclid,
  snapshots.ctwa_id,
  snapshots.created_at,
  exists (
    select 1
    from public.lead_events
    where lead_events.source_snapshot_id = snapshots.id
      and lead_events.event_type = 'duplicate_detected'
  ) as duplicate_detected
from public.lead_source_snapshots as snapshots;
