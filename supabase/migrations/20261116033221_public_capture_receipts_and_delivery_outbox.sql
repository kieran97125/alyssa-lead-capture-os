-- Service-owned, atomic public registration receipts and durable Sheet delivery.
-- Apply before deploying the API. No existing customer rows are rewritten.
create table public.public_lead_capture_receipts (
  form_id uuid not null references public.forms(id) on delete restrict,
  submission_id uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  lead_id uuid not null references public.leads(id) on delete restrict,
  response_json jsonb not null check (jsonb_typeof(response_json) = 'object'),
  created_at timestamptz not null default now(),
  primary key (form_id, submission_id)
);
create index public_lead_capture_receipts_lead_idx on public.public_lead_capture_receipts(lead_id);
alter table public.public_lead_capture_receipts enable row level security;
revoke all on public.public_lead_capture_receipts from public, anon, authenticated,service_role;
grant select, insert on public.public_lead_capture_receipts to service_role;

create table public.public_lead_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete restrict,
  brand_id uuid not null references public.brands(id) on delete restrict,
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  status text not null default 'pending' check (status in ('pending','retry','processing','delivered','blocked','uncertain','skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid null,
  lease_expires_at timestamptz null,
  append_started_at timestamptz null,
  destination_json jsonb null,
  result_json jsonb null,
  last_error_code text null,
  delivered_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index public_lead_delivery_ready_idx on public.public_lead_delivery_outbox(status, next_attempt_at);
create index public_lead_delivery_brand_idx on public.public_lead_delivery_outbox(brand_id, created_at desc);
alter table public.public_lead_delivery_outbox enable row level security;
revoke all on public.public_lead_delivery_outbox from public, anon, authenticated,service_role;
grant select, insert, update on public.public_lead_delivery_outbox to service_role;
comment on table public.public_lead_delivery_outbox is 'Private immutable capture-to-Sheet projection. Never stores webhook secrets or access tokens. Ambiguous append outcomes reconcile without blind retry.';

create table public.public_lead_delivery_rechecks (
  id uuid primary key default gen_random_uuid(),
  actor_member_id uuid not null references public.workspace_members(id) on delete restrict,
  delivery_ids uuid[] not null,
  delivery_count integer not null check (delivery_count >= 0 and delivery_count = cardinality(delivery_ids)),
  created_at timestamptz not null default now()
);
create index public_lead_delivery_rechecks_actor_idx on public.public_lead_delivery_rechecks(actor_member_id,created_at desc);
alter table public.public_lead_delivery_rechecks enable row level security;
revoke all on public.public_lead_delivery_rechecks from public,anon,authenticated,service_role;
grant select,insert on public.public_lead_delivery_rechecks to service_role;
comment on table public.public_lead_delivery_rechecks is 'Append-only audit of master-requested delivery rechecks. Contains member and delivery identifiers only, never customer fields or payloads.';

create or replace function public.capture_public_lead_v1(
  p_form_id uuid, p_submission_id uuid, p_request_hash text,
  p_contact jsonb, p_snapshot jsonb, p_lead jsonb,
  p_events jsonb, p_delivery jsonb, p_response jsonb
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  v_receipt public.public_lead_capture_receipts%rowtype;
  v_form public.forms%rowtype;
  v_contact_id uuid;
  v_snapshot_id uuid := gen_random_uuid();
  v_lead_id uuid := gen_random_uuid();
  v_delivery_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_duplicate_id uuid;
  v_recent_lead public.leads%rowtype;
  v_is_duplicate boolean := false;
  v_response jsonb;
  v_package public.packages%rowtype;
  v_branch_id uuid := (p_lead->>'branch_id')::uuid;
  v_treatment_id uuid := (p_lead->>'treatment_id')::uuid;
  v_phone text := p_contact->>'normalized_phone';
  v_delivery_status text;
  v_allowed_package_ids uuid[];
  v_allowed_branch_ids uuid[];
  v_delivery_payload jsonb;
  v_hk_day text;
begin
  if p_form_id is null or p_submission_id is null or p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_contact) is distinct from 'object' or jsonb_typeof(p_snapshot) is distinct from 'object'
     or jsonb_typeof(p_lead) is distinct from 'object' or jsonb_typeof(p_events) is distinct from 'array'
     or jsonb_typeof(p_delivery) is distinct from 'object' or jsonb_typeof(p_response) is distinct from 'object'
     or jsonb_typeof(p_delivery->'payload') is distinct from 'object'
     or coalesce(v_phone,'') !~ '^[0-9+]{8,18}$' then
    raise exception 'capture_invalid_request' using errcode = '22023';
  end if;
  if jsonb_array_length(p_events) not between 3 and 4 then
    raise exception 'capture_invalid_events' using errcode = '22023';
  end if;
  -- Receipt lock first; another request cannot observe a partial registration.
  perform pg_advisory_xact_lock(hashtextextended('public-capture:' || p_form_id::text || ':' || p_submission_id::text, 0));
  select * into v_receipt from public.public_lead_capture_receipts
    where form_id = p_form_id and submission_id = p_submission_id;
  if found then
    if v_receipt.request_hash <> p_request_hash then
      raise exception 'capture_idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object('response',v_receipt.response_json,'replayed',true);
  end if;
  select * into v_form from public.forms where id = p_form_id for share;
  if not found or v_form.status <> 'active' or (p_lead->>'brand_id')::uuid is distinct from v_form.brand_id
     or (p_lead->>'form_id')::uuid is distinct from p_form_id
     or p_lead->>'normalized_phone' is distinct from v_phone
     or p_snapshot->>'source_type' is distinct from p_lead->>'source_type' then
    raise exception 'capture_form_changed' using errcode = '22023';
  end if;
  select * into v_package from public.packages where id = (p_lead->>'package_id')::uuid and treatment_id = v_treatment_id and status = 'active' for share;
  if not found or not exists(select 1 from public.treatments where id = v_treatment_id and brand_id = v_form.brand_id and status = 'active')
     or not exists(select 1 from public.branches where id = v_branch_id and brand_id = v_form.brand_id and status = 'active')
     or coalesce(v_package.promo_price,v_package.original_price,0) is distinct from (p_lead->>'price')::numeric
     or coalesce(v_package.currency,'HKD') is distinct from p_lead->>'currency' then
    raise exception 'capture_offer_changed' using errcode = '22023';
  end if;
  -- Revalidate the same visitor-visible selection contract inside the capture
  -- transaction. API validation alone may precede an administrator's edit.
  -- Treatments derive from the permitted package's treatment, so customer-choice
  -- forms can expose more than forms.default_treatment_id.
  if coalesce(v_form.package_selection_mode,'fixed') = 'customer_choice' then
    select coalesce(array_agg(fp.package_id),array[]::uuid[]) into v_allowed_package_ids
      from (select package_id from public.form_packages
        where form_id = p_form_id and is_active = true for share) fp;
    if cardinality(v_allowed_package_ids) = 0 then
      v_allowed_package_ids := array_remove(array[v_form.default_package_id],null);
    end if;
  else
    v_allowed_package_ids := array_remove(array[v_form.default_package_id],null);
  end if;
  if not (v_package.id = any(v_allowed_package_ids)) then
    raise exception 'capture_package_not_allowed' using errcode = '22023';
  end if;
  select coalesce(array_agg(fb.branch_id),array[]::uuid[]) into v_allowed_branch_ids
    from (select branch_id from public.form_branches
      where form_id = p_form_id and is_active = true for share) fb;
  if cardinality(v_allowed_branch_ids) = 0 and v_form.default_branch_id is not null then
    v_allowed_branch_ids := array[v_form.default_branch_id];
  end if;
  -- With neither selected branches nor a default, the existing public form
  -- exposes every active branch of this brand (already checked above).
  if cardinality(v_allowed_branch_ids) > 0 and not (v_branch_id = any(v_allowed_branch_ids)) then
    raise exception 'capture_branch_not_allowed' using errcode = '22023';
  end if;
  -- A committed registration must contain its persisted-success, legal-consent
  -- and booking-request events. Anonymous telemetry cannot supply these rows.
  if jsonb_array_length(p_events) <> 3 + (case when p_lead->>'source_type' = 'organic_unknown' then 1 else 0 end)
     or exists(select 1 from jsonb_array_elements(p_events) e
      where jsonb_typeof(e) is distinct from 'object'
        or coalesce(e->>'event_type','') not in ('form_submit_success','booking_created','organic_source_assigned')
        or jsonb_typeof(e->'event_payload_json') is distinct from 'object')
     or (select count(*) from jsonb_array_elements(p_events) e where e->>'event_type' = 'form_submit_success') <> 2
     or (select count(*) from jsonb_array_elements(p_events) e where e->>'event_type' = 'booking_created'
       and e->'event_payload_json'->>'booking_status' = 'requested'
       and e->'event_payload_json'->>'created_by_source' = p_lead->>'source_type') <> 1
     or (select count(*) from jsonb_array_elements(p_events) e where e->>'event_type' = 'form_submit_success'
       and e->'event_payload_json'->>'consent_event' = 'legal_consent_accepted'
       and e->'event_payload_json'->>'form_token' = v_form.public_form_token
       and nullif(btrim(e->'event_payload_json'->>'consent_text'),'') is not null
       and isfinite((e->'event_payload_json'->>'accepted_at')::timestamptz)) <> 1
     or (select count(*) from jsonb_array_elements(p_events) e where e->>'event_type' = 'organic_source_assigned')
       <> (case when p_lead->>'source_type' = 'organic_unknown' then 1 else 0 end) then
    raise exception 'capture_invalid_events' using errcode = '22023';
  end if;
  -- This remains the pre-existing short-window same-form rule, not global phone deduplication.
  perform pg_advisory_xact_lock(hashtextextended('public-capture-phone:' || p_form_id::text || ':' || v_phone, 0));
  if exists(select 1 from public.leads where form_id = p_form_id and normalized_phone = v_phone and created_at >= v_now - interval '3 minutes') then
    raise exception 'capture_duplicate_recent' using errcode = 'P0001';
  end if;
  insert into public.contacts(customer_name, phone, normalized_phone, email)
    values(p_contact->>'customer_name',p_contact->>'phone',v_phone,p_contact->>'email')
    on conflict(normalized_phone) do update set customer_name = excluded.customer_name, phone = excluded.phone, email = excluded.email, updated_at = v_now
    returning id into v_contact_id;
  -- Preserve the previous rule: inspect the newest same-brand/treatment lead,
  -- then test its outcome. Do not resurrect an older unpaid enquiry when the
  -- latest lead is already paid/confirmed. IS DISTINCT FROM preserves the
  -- previous JavaScript comparison for legacy NULL statuses.
  select * into v_recent_lead from public.leads
    where normalized_phone = v_phone and brand_id = v_form.brand_id and treatment_id = v_treatment_id
      and created_at >= v_now - interval '24 hours'
    order by created_at desc,id desc limit 1;
  v_is_duplicate := found and v_recent_lead.payment_status is distinct from 'paid'
    and v_recent_lead.booking_status is distinct from 'confirmed';
  v_duplicate_id := case when v_is_duplicate then v_recent_lead.id else null end;
  insert into public.lead_source_snapshots(id, contact_id, source_type, visitor_id, session_id, first_touch_json, latest_touch_json, submitted_touch_json, raw_payload_json, utm_source, utm_medium, utm_campaign, utm_id, utm_content, utm_term, fbclid, gclid, ttclid, msclkid, wbraid, gbraid, referrer, landing_page_url, current_page_url, page_path, page_title, source_capture_method, attribution_quality, tracking_status, audit_reason, ctwa_id, whatsapp_message_id, whatsapp_conversation_id, whatsapp_phone_number_id, meta_ad_id, meta_adset_id, meta_campaign_id, meta_source_url, whatsapp_referral_headline, whatsapp_referral_body, whatsapp_referral_source_type, whatsapp_referral_source_id, first_seen_at, last_seen_at)
    select v_snapshot_id, v_contact_id, s.source_type, s.visitor_id, s.session_id, s.first_touch_json, s.latest_touch_json, s.submitted_touch_json, s.raw_payload_json, s.utm_source, s.utm_medium, s.utm_campaign, s.utm_id, s.utm_content, s.utm_term, s.fbclid, s.gclid, s.ttclid, s.msclkid, s.wbraid, s.gbraid, s.referrer, s.landing_page_url, s.current_page_url, s.page_path, s.page_title, s.source_capture_method, s.attribution_quality, s.tracking_status, s.audit_reason, s.ctwa_id, s.whatsapp_message_id, s.whatsapp_conversation_id, s.whatsapp_phone_number_id, s.meta_ad_id, s.meta_adset_id, s.meta_campaign_id, s.meta_source_url, s.whatsapp_referral_headline, s.whatsapp_referral_body, s.whatsapp_referral_source_type, s.whatsapp_referral_source_id, s.first_seen_at, s.last_seen_at
    from jsonb_populate_record(null::public.lead_source_snapshots, p_snapshot) s;
  insert into public.leads(id,contact_id,lead_uid,source_snapshot_id,source_type,form_id,brand_id,treatment_id,package_id,branch_id,customer_name,phone,normalized_phone,appointment_date,appointment_time,price,currency,payment_status,lead_status,booking_status,submitted_at)
    values(v_lead_id,v_contact_id,gen_random_uuid()::text,v_snapshot_id,p_lead->>'source_type',p_form_id,v_form.brand_id,v_treatment_id,v_package.id,v_branch_id,p_lead->>'customer_name',p_lead->>'phone',v_phone,(p_lead->>'appointment_date')::date,p_lead->>'appointment_time',(p_lead->>'price')::numeric,p_lead->>'currency',p_lead->>'payment_status',case when v_is_duplicate then 'duplicate' else 'submitted' end,'requested',v_now);
  update public.lead_source_snapshots set lead_id = v_lead_id where id = v_snapshot_id;
  insert into public.bookings(lead_id,contact_id,brand_id,treatment_id,branch_id,appointment_date,appointment_time,booking_status,created_by_source)
    values(v_lead_id,v_contact_id,v_form.brand_id,v_treatment_id,v_branch_id,(p_lead->>'appointment_date')::date,p_lead->>'appointment_time','requested',p_lead->>'source_type');
  insert into public.lead_events(lead_id,contact_id,source_snapshot_id,visitor_id,session_id,event_type,event_payload_json,page_url,referrer)
    select v_lead_id,v_contact_id,v_snapshot_id,e->>'visitor_id',e->>'session_id',e->>'event_type',
      coalesce(e->'event_payload_json','{}'::jsonb) || case when e->>'event_type' = 'form_submit_success' and coalesce(e->'event_payload_json'->>'consent_event','') = '' then jsonb_build_object('is_duplicate',v_is_duplicate) else '{}'::jsonb end,
      e->>'page_url',e->>'referrer' from jsonb_array_elements(p_events) e;
  if v_is_duplicate then
    insert into public.lead_events(lead_id,contact_id,source_snapshot_id,event_type,event_payload_json)
      values(v_lead_id,v_contact_id,v_snapshot_id,'duplicate_detected',jsonb_build_object('duplicate_of_lead_id',v_duplicate_id));
  end if;
  v_delivery_status := case when v_is_duplicate or coalesce((p_delivery->>'enabled')::boolean,false) = false then 'skipped' else 'pending' end;
  if jsonb_typeof(p_delivery->'payload'->'rowValues') is distinct from 'array' then
    raise exception 'capture_invalid_delivery' using errcode = '22023';
  end if;
  if jsonb_array_length(p_delivery->'payload'->'rowValues') < 2 then
    raise exception 'capture_invalid_delivery' using errcode = '22023';
  end if;
  -- Store the same Hong Kong day as the committed database registration, even
  -- when application preparation and transaction execution straddle midnight.
  v_hk_day := to_char(v_now at time zone 'Asia/Hong_Kong','YYYY-MM-DD');
  v_delivery_payload := (p_delivery->'payload') || jsonb_build_object(
    'leadKey',v_lead_id,'secret','','createdAt',v_hk_day,'lastUpdatedAt',v_hk_day);
  v_delivery_payload := jsonb_set(jsonb_set(v_delivery_payload,
    '{rowValues,0}',to_jsonb(v_hk_day),false),'{rowValues,1}',to_jsonb(v_hk_day),false);
  insert into public.public_lead_delivery_outbox(id,lead_id,brand_id,payload_json,status,last_error_code)
    values(v_delivery_id,v_lead_id,v_form.brand_id,
      v_delivery_payload,v_delivery_status,
      case when v_is_duplicate then 'duplicate_lead' when v_delivery_status = 'skipped' then 'sync_disabled' else null end);
  v_response := p_response || jsonb_build_object('ok',true,'lead_id',v_lead_id,'contact_id',v_contact_id,'source_snapshot_id',v_snapshot_id,'delivery_id',v_delivery_id,'delivery_status',v_delivery_status,'event_id',coalesce(nullif(p_response->>'event_id',''),v_lead_id::text));
  insert into public.public_lead_capture_receipts(form_id,submission_id,request_hash,lead_id,response_json)
    values(p_form_id,p_submission_id,p_request_hash,v_lead_id,v_response);
  return jsonb_build_object('response',v_response,'replayed',false);
end;
$$;
revoke all on function public.capture_public_lead_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.capture_public_lead_v1(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;

create or replace function public.claim_public_lead_deliveries(p_delivery_id uuid default null, p_limit integer default 5)
returns setof public.public_lead_delivery_outbox
language plpgsql security invoker set search_path = public, pg_temp
as $$
begin
  return query
    with candidates as (
      select d.id from public.public_lead_delivery_outbox d
      where (p_delivery_id is null or d.id = p_delivery_id)
        and ((d.status in ('pending','retry','uncertain') and d.next_attempt_at <= now() and d.attempt_count < 8)
          or (d.status = 'processing' and d.lease_expires_at < now()))
      order by d.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,5),10))
    )
    update public.public_lead_delivery_outbox d set status = 'processing',attempt_count = d.attempt_count + 1,
      lease_token = gen_random_uuid(),lease_expires_at = now() + interval '2 minutes',updated_at = now(),
      append_started_at = case when d.status in ('processing','uncertain') then coalesce(d.append_started_at,now()) else d.append_started_at end
    from candidates c where d.id = c.id returning d.*;
end;
$$;
revoke all on function public.claim_public_lead_deliveries(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_public_lead_deliveries(uuid,integer) to service_role;

create or replace function public.recheck_public_lead_deliveries(p_actor_id uuid,p_limit integer default 10)
returns integer
language plpgsql security invoker set search_path = public,pg_temp
as $$
declare
  v_delivery_ids uuid[];
begin
  -- The application also requires master access. Retain an attributable,
  -- current member identity here rather than accepting a generic shared login.
  perform 1 from public.workspace_members
    where id = p_actor_id and status in ('active','invited')
      and (is_master = true or workspace_role = 'owner') for share;
  if not found then
    raise exception 'delivery_recheck_master_required' using errcode = '42501';
  end if;
  with candidates as (
    select d.id from public.public_lead_delivery_outbox d
      where d.status in ('blocked','uncertain')
        and (d.lease_expires_at is null or d.lease_expires_at <= now())
      order by d.created_at,d.id for update skip locked
      limit greatest(1,least(coalesce(p_limit,10),10))
  ), updated as (
    update public.public_lead_delivery_outbox d
      set status = case when d.append_started_at is null then 'retry' else 'uncertain' end,
        attempt_count = 0,next_attempt_at = now(),lease_token = null,
        lease_expires_at = null,updated_at = now()
      from candidates c where d.id = c.id returning d.id
  )
  select coalesce(array_agg(id),array[]::uuid[]) into v_delivery_ids from updated;
  insert into public.public_lead_delivery_rechecks(actor_member_id,delivery_ids,delivery_count)
    values(p_actor_id,v_delivery_ids,cardinality(v_delivery_ids));
  return cardinality(v_delivery_ids);
end;
$$;
revoke all on function public.recheck_public_lead_deliveries(uuid,integer) from public,anon,authenticated;
grant execute on function public.recheck_public_lead_deliveries(uuid,integer) to service_role;

create or replace function public.get_public_lead_delivery_summary()
returns jsonb
language sql stable security invoker set search_path = public,pg_temp
as $$
  select jsonb_build_object(
    'counts',jsonb_build_object(
      'pending',count(*) filter (where status = 'pending'),
      'retry',count(*) filter (where status = 'retry'),
      'processing',count(*) filter (where status = 'processing'),
      'delivered',count(*) filter (where status = 'delivered'),
      'blocked',count(*) filter (where status = 'blocked'),
      'uncertain',count(*) filter (where status = 'uncertain'),
      'skipped',count(*) filter (where status = 'skipped')),
    'checked_at',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
  from public.public_lead_delivery_outbox;
$$;
revoke all on function public.get_public_lead_delivery_summary() from public,anon,authenticated;
grant execute on function public.get_public_lead_delivery_summary() to service_role;
