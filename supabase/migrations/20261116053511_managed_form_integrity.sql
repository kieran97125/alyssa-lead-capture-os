-- Managed acquisition settings are one transaction; existing public tokens stay stable.
alter table public.forms
  add column if not exists revision bigint not null default 1,
  add column if not exists placement_kind text not null default 'unspecified',
  add column if not exists placement_url text null;
alter table public.forms
  add constraint forms_managed_revision_positive check (revision > 0),
  add constraint forms_placement_kind_allowed check (placement_kind in ('unspecified','wix','landing_page','both')),
  add constraint forms_placement_url_valid check (placement_url is null or
    (length(placement_url) <= 2000 and placement_url ~ '^https?://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$'));

-- Legacy administrative writers must also invalidate an already-open editor.
create function public.bump_managed_form_revision_v1() returns trigger
language plpgsql security invoker set search_path = public,pg_temp as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.bump_managed_form_revision_v1() from public,anon,authenticated,service_role;
grant execute on function public.bump_managed_form_revision_v1() to service_role;
create trigger forms_managed_revision before update on public.forms
for each row execute function public.bump_managed_form_revision_v1();

create table public.acquisition_operation_receipts (
  operation text not null,
  request_id uuid not null,
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_json jsonb not null check (jsonb_typeof(response_json) = 'object'),
  created_at timestamptz not null default now(),
  primary key (operation,request_id)
);
alter table public.acquisition_operation_receipts enable row level security;
revoke all on public.acquisition_operation_receipts from public,anon,authenticated,service_role;
grant select,insert on public.acquisition_operation_receipts to service_role;
comment on table public.acquisition_operation_receipts is
  'Private immutable settings-operation replay receipts. Placement is intended usage, never proof of installation.';

create function public.mutate_managed_form_v1(
  p_operation text,p_form_id uuid,p_expected_revision bigint,p_request_id uuid,p_payload jsonb
) returns jsonb
language plpgsql security invoker set search_path = public,pg_temp as $$
declare
  v_form public.forms%rowtype;
  v_source public.forms%rowtype;
  v_receipt public.acquisition_operation_receipts%rowtype;
  v_payload jsonb := coalesce(p_payload,'{}'::jsonb);
  v_hash text;
  v_response jsonb;
  v_brand uuid;
  v_treatment uuid;
  v_package uuid;
  v_branch uuid;
  v_packages uuid[];
  v_branches uuid[];
  v_domains text[];
  v_mode text;
  v_kind text;
  v_url text;
  v_name text;
  v_token_base text;
  v_token text;
begin
  if p_operation is null or p_operation not in ('create','update','duplicate','archive','restore','delete')
     or jsonb_typeof(v_payload) <> 'object' then
    raise exception 'managed_form_invalid_request' using errcode='22023';
  end if;
  if p_operation in ('create','duplicate') then
    if p_request_id is null then
      raise exception 'managed_form_request_id_required' using errcode='22023';
    end if;
    v_hash := encode(sha256(convert_to(jsonb_build_object(
      'operation',p_operation,'form_id',p_form_id,'revision',p_expected_revision,'payload',v_payload - array['token_base','conversion_mode','success_redirect_url']
    )::text,'UTF8')),'hex');
    perform pg_advisory_xact_lock(hashtextextended('managed-form:'||p_operation||':'||p_request_id::text,0));
    select * into v_receipt from public.acquisition_operation_receipts
      where operation=p_operation and request_id=p_request_id;
    if found then
      if v_receipt.request_hash <> v_hash then
        raise exception 'managed_form_request_conflict' using errcode='22023';
      end if;
      return v_receipt.response_json || jsonb_build_object('replayed',true);
    end if;
  end if;

  if p_operation <> 'create' then
    select * into v_source from public.forms where id=p_form_id for update;
    if not found then raise exception 'managed_form_not_found' using errcode='P0002'; end if;
    if p_expected_revision is null or p_expected_revision <> v_source.revision then
      raise exception 'managed_form_revision_conflict' using errcode='40001';
    end if;
    if p_operation='archive' then
      update public.forms set status='archived' where id=v_source.id returning * into v_form;
      return jsonb_build_object('form',to_jsonb(v_form),'replayed',false);
    end if;
    if p_operation='delete' then
      -- Locking the parent first also fences new FK references/capture operations.
      if exists(select 1 from public.leads where form_id=v_source.id)
         or exists(select 1 from public.landing_pages where form_id=v_source.id)
         or exists(select 1 from public.public_lead_capture_receipts where form_id=v_source.id) then
        raise exception 'managed_form_in_use' using errcode='23503';
      end if;
      delete from public.form_branches where form_id=v_source.id;
      delete from public.form_packages where form_id=v_source.id;
      delete from public.forms where id=v_source.id;
      return jsonb_build_object('form',to_jsonb(v_source),'deleted',true,'replayed',false);
    end if;
    if p_operation in ('duplicate','restore') then
      v_payload := jsonb_build_object(
        'form_name',case when p_operation='duplicate' then left(v_source.form_name,156)||'（副本）' else v_source.form_name end,
        'brand_id',v_source.brand_id,'default_treatment_id',v_source.default_treatment_id,
        'default_package_id',v_source.default_package_id,'default_branch_id',v_source.default_branch_id,
        'package_selection_mode',v_source.package_selection_mode,
        'package_ids',coalesce((select jsonb_agg(package_id order by display_order,id) from public.form_packages where form_id=v_source.id and is_active),jsonb_build_array(v_source.default_package_id)),
        'branch_ids',coalesce((select jsonb_agg(branch_id order by display_order,id) from public.form_branches where form_id=v_source.id and is_active),jsonb_build_array(v_source.default_branch_id)),
        'allowed_domains',to_jsonb(v_source.allowed_domains),'conversion_mode',v_source.conversion_mode,
        'success_redirect_url',v_source.success_redirect_url,'placement_kind',v_source.placement_kind,
        'placement_url',v_source.placement_url,'token_base','registration-form'
      );
      -- Legacy explicit choice sets may omit the old defaults. Keep those sets;
      -- normalize only the chosen defaults to an already-visible ordered member.
      if v_source.package_selection_mode='customer_choice'
         and not (v_payload->'package_ids' @> jsonb_build_array(v_source.default_package_id)) then
        select p.id,p.treatment_id into v_package,v_treatment
          from jsonb_array_elements_text(v_payload->'package_ids') with ordinality choice(id,ord)
          join public.packages p on p.id=choice.id::uuid
          join public.treatments t on t.id=p.treatment_id
          where p.status='active' and t.status='active' and t.brand_id=v_source.brand_id
          order by choice.ord limit 1;
        v_payload:=v_payload||jsonb_build_object('default_package_id',v_package,'default_treatment_id',v_treatment);
      end if;
      if not (v_payload->'branch_ids' @> jsonb_build_array(v_source.default_branch_id)) then
        v_payload:=v_payload||jsonb_build_object('default_branch_id',v_payload->'branch_ids'->0);
      end if;
    end if;
  end if;

  v_name := btrim(coalesce(v_payload->>'form_name',''));
  v_brand := nullif(v_payload->>'brand_id','')::uuid;
  v_treatment := nullif(v_payload->>'default_treatment_id','')::uuid;
  v_package := nullif(v_payload->>'default_package_id','')::uuid;
  v_branch := nullif(v_payload->>'default_branch_id','')::uuid;
  v_mode := coalesce(v_payload->>'package_selection_mode','fixed');
  v_kind := coalesce(v_payload->>'placement_kind','unspecified');
  v_url := nullif(btrim(v_payload->>'placement_url'),'');
  if v_name='' or length(v_name)>160 or v_brand is null or v_treatment is null
     or v_package is null or v_branch is null or v_mode not in ('fixed','customer_choice')
     or v_kind not in ('unspecified','wix','landing_page','both')
     or (v_url is not null and (length(v_url)>2000 or v_url !~ '^https?://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$'))
     or jsonb_typeof(v_payload->'package_ids') is distinct from 'array'
     or jsonb_typeof(v_payload->'branch_ids') is distinct from 'array'
     or jsonb_typeof(v_payload->'allowed_domains') is distinct from 'array'
     or coalesce(v_payload->>'conversion_mode','form_submit_pixel') not in ('form_submit_pixel','thank_you_redirect') then
    raise exception 'managed_form_invalid_request' using errcode='22023';
  end if;
  if p_operation='update' and v_brand <> v_source.brand_id then
    raise exception 'managed_form_brand_immutable' using errcode='22023';
  end if;
  select coalesce(array_agg(id order by first_ord),array[]::uuid[]) into v_packages
    from (select value::uuid as id,min(ord) as first_ord
      from jsonb_array_elements_text(v_payload->'package_ids') with ordinality x(value,ord) group by value::uuid) selected;
  select coalesce(array_agg(id order by first_ord),array[]::uuid[]) into v_branches
    from (select value::uuid as id,min(ord) as first_ord
      from jsonb_array_elements_text(v_payload->'branch_ids') with ordinality x(value,ord) group by value::uuid) selected;
  select coalesce(array_agg(distinct btrim(value)),array[]::text[]) into v_domains
    from jsonb_array_elements_text(v_payload->'allowed_domains') x(value);
  if v_mode='fixed' then v_packages:=array[v_package]; end if;
  -- Keep active catalogue references stable until memberships are committed.
  perform id from public.brands where id=v_brand for share;
  perform id from public.treatments where id=v_treatment for share;
  perform t.id from public.treatments t join public.packages p on p.treatment_id=t.id
    where p.id=any(v_packages) order by t.id for share of t;
  perform id from public.packages where id=any(v_packages) order by id for share;
  perform id from public.branches where id=any(v_branches) order by id for share;
  if cardinality(v_packages) not between 1 and 100 or cardinality(v_branches) not between 1 and 100
     or not (v_package=any(v_packages)) or not (v_branch=any(v_branches))
     or cardinality(v_domains)>50
     or exists(select 1 from unnest(v_domains) d where d is null or length(d)>2000 or d !~ '^https?://[^/@?#[:space:]]+$')
     or not exists(select 1 from public.brands where id=v_brand)
     or not exists(select 1 from public.treatments where id=v_treatment and brand_id=v_brand and status='active')
     or not exists(select 1 from public.packages where id=v_package and treatment_id=v_treatment and status='active')
     or (select count(*) from public.packages p join public.treatments t on t.id=p.treatment_id
       where p.id=any(v_packages) and p.status='active' and t.status='active' and t.brand_id=v_brand) <> cardinality(v_packages)
     or (select count(*) from public.branches where id=any(v_branches) and brand_id=v_brand and status='active') <> cardinality(v_branches) then
    raise exception 'managed_form_selection_invalid' using errcode='22023';
  end if;

  if p_operation='restore' then
    update public.forms set status='active',default_treatment_id=v_treatment,
      default_package_id=v_package,default_branch_id=v_branch where id=v_source.id returning * into v_form;
    update public.form_packages set is_default=(package_id=v_package) where form_id=v_source.id;
    update public.form_branches set is_default=(branch_id=v_branch) where form_id=v_source.id;
    return jsonb_build_object('form',to_jsonb(v_form),'replayed',false);
  end if;
  if p_operation in ('create','duplicate') then
    v_token_base := coalesce(nullif(v_payload->>'token_base',''),'registration-form');
    if v_token_base !~ '^[a-z0-9][a-z0-9-]{0,99}$' then
      raise exception 'managed_form_invalid_request' using errcode='22023';
    end if;
    v_token := v_token_base||'-'||replace(p_request_id::text,'-','');
    insert into public.forms(
      public_form_token,brand_id,form_name,status,allowed_domains,default_treatment_id,
      default_package_id,default_branch_id,package_selection_mode,conversion_mode,
      success_redirect_url,placement_kind,placement_url
    ) values (
      v_token,v_brand,v_name,'active',v_domains,v_treatment,v_package,v_branch,v_mode,
      coalesce(v_payload->>'conversion_mode','form_submit_pixel'),nullif(v_payload->>'success_redirect_url',''),v_kind,v_url
    ) returning * into v_form;
  else
    update public.forms set
      form_name=v_name,allowed_domains=v_domains,default_treatment_id=v_treatment,
      default_package_id=v_package,default_branch_id=v_branch,package_selection_mode=v_mode,
      conversion_mode=coalesce(v_payload->>'conversion_mode',conversion_mode),
      success_redirect_url=nullif(v_payload->>'success_redirect_url',''),placement_kind=v_kind,placement_url=v_url
    where id=v_source.id returning * into v_form;
  end if;
  delete from public.form_branches where form_id=v_form.id;
  insert into public.form_branches(form_id,branch_id,is_default,is_active,display_order)
    select v_form.id,id,id=v_branch,true,ord::integer-1 from unnest(v_branches) with ordinality b(id,ord);
  delete from public.form_packages where form_id=v_form.id;
  insert into public.form_packages(form_id,package_id,is_default,is_active,display_order)
    select v_form.id,id,id=v_package,true,ord::integer-1 from unnest(v_packages) with ordinality p(id,ord);
  v_response := jsonb_build_object('form',to_jsonb(v_form),'replayed',false);
  if p_operation in ('create','duplicate') then
    insert into public.acquisition_operation_receipts(operation,request_id,request_hash,response_json)
      values(p_operation,p_request_id,v_hash,v_response);
  end if;
  return v_response;
end;
$$;
revoke all on function public.mutate_managed_form_v1(text,uuid,bigint,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.mutate_managed_form_v1(text,uuid,bigint,uuid,jsonb) to service_role;

create function public.get_managed_form_activity_v1(p_form_ids uuid[])
returns table(form_id uuid,last_registration_at timestamptz,last_delivery_at timestamptz,pending_count bigint,blocked_count bigint,uncertain_count bigint)
language plpgsql security invoker stable set search_path = public,pg_temp as $$
begin
  if coalesce(cardinality(p_form_ids),0)>200 then
    raise exception 'managed_form_activity_scope_too_large' using errcode='22023';
  end if;
  return query
    with requested as(select distinct unnest(p_form_ids) as id)
    select f.id,max(l.created_at),max(d.delivered_at) filter(where d.status='delivered'),
      count(d.id) filter(where d.status in ('pending','retry','processing')),
      count(d.id) filter(where d.status='blocked'),count(d.id) filter(where d.status='uncertain')
    from requested r join public.forms f on f.id=r.id
    left join public.leads l on l.form_id=f.id
    left join public.public_lead_delivery_outbox d on d.lead_id=l.id
    group by f.id;
end;
$$;
revoke all on function public.get_managed_form_activity_v1(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.get_managed_form_activity_v1(uuid[]) to service_role;
