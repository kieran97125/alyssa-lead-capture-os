-- Isolated PostgreSQL 17 qualification scaffold. Never run against an application database.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'public_capture_test' THEN
    RAISE EXCEPTION 'This fixture requires isolated database public_capture_test';
  END IF;
END; $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END; $$;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;

-- Schema-only baseline; deliberately excludes the migration's client-specific seeds/views.
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


-- Visitor selection tables/columns added by later production migrations.
ALTER TABLE public.forms ADD COLUMN package_selection_mode text NOT NULL DEFAULT 'fixed'
  CHECK (package_selection_mode IN ('fixed','customer_choice'));
CREATE TABLE public.form_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id),
  package_id uuid NOT NULL REFERENCES public.packages(id),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(form_id,package_id)
);
CREATE TABLE public.form_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(form_id,branch_id)
);
CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'invited',
  is_master boolean NOT NULL DEFAULT false,
  workspace_role text NOT NULL DEFAULT 'viewer'
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['contacts','brands','treatments','packages','branches','forms','lead_source_snapshots','leads','bookings','lead_events','form_packages','form_branches','workspace_members'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t);
  END LOOP;
END; $$;
CREATE SCHEMA capture_fixture;
GRANT USAGE ON SCHEMA capture_fixture TO service_role;
CREATE FUNCTION capture_fixture.seed() RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  INSERT INTO public.workspace_members(id,status,is_master,workspace_role) VALUES
    ('90000000-0000-4000-8000-000000000001','active',true,'owner'),
    ('90000000-0000-4000-8000-000000000002','active',false,'cs'),
    ('90000000-0000-4000-8000-000000000003','suspended',true,'owner');
  INSERT INTO public.brands(id,name,slug) VALUES
    ('a0000000-0000-4000-8000-000000000001','Synthetic A','synthetic-a'),
    ('a0000000-0000-4000-8000-000000000002','Synthetic B','synthetic-b');
  INSERT INTO public.treatments(id,brand_id,name,slug) VALUES
    ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Synthetic A1','synthetic-a1'),
    ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Synthetic A2','synthetic-a2'),
    ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','Synthetic B1','synthetic-b1');
  INSERT INTO public.packages(id,treatment_id,name,promo_price,currency) VALUES
    ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Synthetic Offer A1',100,'HKD'),
    ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','Synthetic Offer A2',200,'HKD'),
    ('c0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000003','Synthetic Offer B1',300,'HKD');
  INSERT INTO public.branches(id,brand_id,name,slug) VALUES
    ('d0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Synthetic A1','synthetic-a1'),
    ('d0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Synthetic A2','synthetic-a2'),
    ('d0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','Synthetic B1','synthetic-b1');
  INSERT INTO public.forms(id,brand_id,form_name,public_form_token,default_treatment_id,default_package_id,default_branch_id,package_selection_mode) VALUES
    ('e0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Synthetic Fixed A1','synthetic-fixed-a1','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','fixed'),
    ('e0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Synthetic Fixed A2','synthetic-fixed-a2','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','fixed'),
    ('e0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','Synthetic Fixed B1','synthetic-fixed-b1','b0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000003','fixed'),
    ('e0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000001','Synthetic Choice','synthetic-choice','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','customer_choice'),
    ('e0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000001','Synthetic Any Branch','synthetic-any-branch','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',NULL,'fixed'),
    ('e0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000001','Synthetic Choice Fallback','synthetic-choice-fallback','b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','customer_choice');
  INSERT INTO public.form_packages(form_id,package_id) VALUES ('e0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000002');
  INSERT INTO public.form_branches(form_id,branch_id) VALUES ('e0000000-0000-4000-8000-000000000004','d0000000-0000-4000-8000-000000000002');
END; $$;
CREATE FUNCTION capture_fixture.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'qualification_failed: %',label; END IF;
END; $$;
CREATE FUNCTION capture_fixture.counts() RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN
  RETURN (SELECT jsonb_build_array((SELECT count(*) FROM public.contacts),(SELECT count(*) FROM public.lead_source_snapshots),
    (SELECT count(*) FROM public.leads),(SELECT count(*) FROM public.bookings),(SELECT count(*) FROM public.lead_events),
    (SELECT count(*) FROM public.public_lead_capture_receipts),(SELECT count(*) FROM public.public_lead_delivery_outbox)));
END; $$;
CREATE FUNCTION capture_fixture.capture(
  submission uuid, phone text, form uuid DEFAULT 'e0000000-0000-4000-8000-000000000001',
  lead_patch jsonb DEFAULT '{}', request_hash text DEFAULT repeat('a',64),
  event_patch jsonb DEFAULT '{}', delivery_enabled boolean DEFAULT true,
  consent_patch jsonb DEFAULT '{}', events_override jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE f public.forms%rowtype; p public.packages%rowtype; lead jsonb; events jsonb; BEGIN
  SELECT * INTO f FROM public.forms WHERE id=form;
  SELECT * INTO p FROM public.packages WHERE id=coalesce((lead_patch->>'package_id')::uuid,f.default_package_id);
  lead := jsonb_build_object('form_id',form,'brand_id',f.brand_id,'treatment_id',p.treatment_id,
    'package_id',p.id,'branch_id',f.default_branch_id,'customer_name','Synthetic fixture','phone',phone,
    'normalized_phone',phone,'appointment_date','2026-12-01','appointment_time','12:00','price',coalesce(p.promo_price,p.original_price,0),
    'currency',p.currency,'source_type','reg_form_utm','payment_status','unpaid') || lead_patch;
  events := jsonb_build_array(
    jsonb_build_object('event_type','form_submit_success','event_payload_json',event_patch),
    jsonb_build_object('event_type','form_submit_success','event_payload_json',jsonb_build_object('consent_event','legal_consent_accepted','form_token',f.public_form_token,'consent_text','synthetic_fixture_consent_v1','accepted_at','2026-11-16T00:00:00Z') || consent_patch),
    jsonb_build_object('event_type','booking_created','event_payload_json',jsonb_build_object('booking_status','requested','created_by_source',lead->>'source_type'))
  );
  IF lead->>'source_type'='organic_unknown' THEN events:=events||jsonb_build_array(jsonb_build_object('event_type','organic_source_assigned','event_payload_json','{}'::jsonb)); END IF;
  IF events_override IS NOT NULL THEN events:=events_override; END IF;
  RETURN public.capture_public_lead_v1(form,submission,request_hash,
    jsonb_build_object('customer_name','Synthetic fixture','phone',phone,'normalized_phone',phone),
    jsonb_build_object('source_type',lead->>'source_type','tracking_status','complete_utm','first_touch_json','{}'::jsonb),
    lead,events,jsonb_build_object('enabled',delivery_enabled,'payload',jsonb_build_object('phone',phone,'fixture',true,'rowValues',jsonb_build_array('stale-day-a','stale-day-b','preserved-field'))),
    jsonb_build_object('event_id',submission::text));
END; $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA capture_fixture FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA capture_fixture TO service_role;
