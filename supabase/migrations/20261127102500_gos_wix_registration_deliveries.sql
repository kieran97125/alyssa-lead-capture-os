-- Wix owns these original bookings and submissions. Only the immutable Sheet
-- projection lives here. An external event never creates a second OS appointment.
create table public.gos_wix_registration_deliveries (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('form','booking')),
  source_id uuid not null,
  unique (source_kind,source_id),
  lead_id uuid not null unique,
  brand_id uuid not null references public.brands(id) check (brand_id='787fceca-2f8a-4f77-9e3e-94a859369e5f'),
  payload_json jsonb not null check (jsonb_typeof(payload_json)='object' and payload_json->>'secret'=''),
  status text not null default 'pending' check (status in ('pending','retry','processing','delivered','blocked','uncertain')),
  attempt_count integer not null default 0 check (attempt_count>=0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  append_started_at timestamptz,
  destination_json jsonb,
  result_json jsonb,
  last_error_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gos_wix_registration_pending on public.gos_wix_registration_deliveries(next_attempt_at)
  where status in ('pending','retry','uncertain','processing');
alter table public.gos_wix_registration_deliveries enable row level security;
revoke all on public.gos_wix_registration_deliveries from public,anon,authenticated,service_role;
grant select,insert,update on public.gos_wix_registration_deliveries to service_role;

create function public.claim_gos_wix_registration_deliveries(p_delivery_id uuid default null,p_limit integer default 3)
returns setof public.gos_wix_registration_deliveries
language sql security invoker set search_path = public, pg_temp as $$
  with candidates as (
    select id from public.gos_wix_registration_deliveries
    where (p_delivery_id is null or id=p_delivery_id)
      and ((status in ('pending','retry','uncertain') and next_attempt_at<=now() and attempt_count<8)
        or (status='processing' and lease_expires_at<now()))
    order by created_at for update skip locked limit greatest(1,least(coalesce(p_limit,3),3))
  )
  update public.gos_wix_registration_deliveries as d
  set status='processing',attempt_count=d.attempt_count+1,lease_token=gen_random_uuid(),
      lease_expires_at=now()+interval '2 minutes',updated_at=now()
  from candidates where d.id=candidates.id returning d.*;
$$;
revoke all on function public.claim_gos_wix_registration_deliveries(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_gos_wix_registration_deliveries(uuid,integer) to service_role;
