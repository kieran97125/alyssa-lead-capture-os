-- Immutable draft metadata and atomic landing-page publication.
-- Existing public routing/content is copied exactly; historical routing before
-- this migration cannot be reconstructed from rows that did not record it.
alter table public.landing_pages add column if not exists revision bigint not null default 1;
alter table public.landing_page_versions add column if not exists metadata_json jsonb;
alter table public.landing_page_versions add column if not exists page_revision bigint;

update public.landing_page_versions v
set metadata_json = jsonb_build_object(
  'slug',p.slug,'title',p.title,'brand_id',p.brand_id,
  'treatment_id',p.treatment_id,'package_id',p.package_id,
  'branch_id',p.branch_id,'form_id',p.form_id,
  'template_key',p.template_key,'mode',p.mode,
  'metadata_source','legacy_current_row')
from public.landing_pages p
where p.id=v.page_id and v.metadata_json is null;
alter table public.landing_page_versions alter column metadata_json set default '{}'::jsonb;
alter table public.landing_page_versions alter column metadata_json set not null;
alter table public.landing_pages add constraint landing_page_revision_positive check(revision>0);
alter table public.landing_page_versions add constraint landing_page_metadata_object check(jsonb_typeof(metadata_json)='object');
alter table public.landing_page_versions add constraint landing_page_saved_revision_positive check(page_revision is null or page_revision>0);
create unique index if not exists landing_page_versions_owner_idx
  on public.landing_page_versions(page_id,id);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='landing_pages_published_version_owner_fkey'
    and conrelid='public.landing_pages'::regclass) then
    alter table public.landing_pages add constraint landing_pages_published_version_owner_fkey
      foreign key(id,published_version_id) references public.landing_page_versions(page_id,id)
      deferrable initially immediate;
  end if;
end; $$;

create or replace function public.advance_landing_page_revision_v1()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  new.revision:=greatest(old.revision+1,coalesce(new.revision,old.revision+1));
  return new;
end; $$;
drop trigger if exists landing_page_revision_v1 on public.landing_pages;
create trigger landing_page_revision_v1 before update on public.landing_pages
for each row execute function public.advance_landing_page_revision_v1();
revoke all on function public.advance_landing_page_revision_v1() from public,anon,authenticated;
grant execute on function public.advance_landing_page_revision_v1() to service_role;

create or replace function public.protect_landing_page_version_v1()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' or old.status='published' then
    raise exception 'landing_version_immutable' using errcode='23503';
  end if;
  return old;
end; $$;
revoke all on function public.protect_landing_page_version_v1() from public,anon,authenticated;
grant execute on function public.protect_landing_page_version_v1() to service_role;
create trigger landing_page_version_immutable_v1 before update or delete on public.landing_page_versions
for each row execute function public.protect_landing_page_version_v1();

-- A chosen draft form is stored in version metadata, while the parent keeps its
-- approved public form. Protect both references against deletion.
create or replace function public.protect_landing_page_form_reference_v1()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.landing_page_versions where metadata_json->>'form_id'=old.id::text) then
    raise exception 'landing_form_has_version_references' using errcode='23503';
  end if;
  return old;
end; $$;
revoke all on function public.protect_landing_page_form_reference_v1() from public,anon,authenticated;
grant execute on function public.protect_landing_page_form_reference_v1() to service_role;
create trigger landing_page_form_reference_v1 before delete on public.forms
for each row execute function public.protect_landing_page_form_reference_v1();

-- Row-level locks serialize publication with a concurrent form edit/archive.
create or replace function public.resolve_landing_page_metadata_v1(
  p_brand_id uuid,p_metadata jsonb,p_require_active boolean
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare f public.forms%rowtype; t public.treatments%rowtype;
  pkg public.packages%rowtype; br public.branches%rowtype;
  v_slug text; v_title text;
begin
  if jsonb_typeof(p_metadata)<>'object' then raise exception 'landing_invalid_document' using errcode='22023'; end if;
  v_slug:=btrim(coalesce(p_metadata->>'slug',''));
  v_title:=btrim(coalesce(p_metadata->>'title',''));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug)>160
    or v_title='' or length(v_title)>200 then
    raise exception 'landing_invalid_metadata' using errcode='22023';
  end if;
  select * into f from public.forms where id=(p_metadata->>'form_id')::uuid for share;
  if not found then raise exception 'landing_form_missing' using errcode='22023'; end if;
  if p_brand_id is null or f.brand_id<>p_brand_id then
    raise exception 'landing_brand_mismatch' using errcode='22023';
  end if;
  if p_require_active and f.status<>'active' then
    raise exception 'landing_form_inactive' using errcode='22023';
  end if;
  select * into t from public.treatments where id=f.default_treatment_id for share;
  select * into pkg from public.packages where id=f.default_package_id for share;
  select * into br from public.branches where id=f.default_branch_id for share;
  if t.id is null or pkg.id is null or br.id is null or t.brand_id<>p_brand_id
    or pkg.treatment_id<>t.id or br.brand_id<>p_brand_id then
    raise exception 'landing_offer_invalid' using errcode='22023';
  end if;
  if p_require_active and (t.status<>'active' or pkg.status<>'active' or br.status<>'active') then
    raise exception 'landing_offer_inactive' using errcode='22023';
  end if;
  return jsonb_build_object('slug',v_slug,'title',v_title,'brand_id',p_brand_id,
    'treatment_id',t.id,'package_id',pkg.id,'branch_id',br.id,'form_id',f.id,
    'template_key',coalesce(nullif(p_metadata->>'template_key',''),'premium_offer_landing_page'),
    'mode',coalesce(nullif(p_metadata->>'mode',''),'landing_page'),
    'metadata_source','version_snapshot');
end; $$;
revoke all on function public.resolve_landing_page_metadata_v1(uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.resolve_landing_page_metadata_v1(uuid,jsonb,boolean) to service_role;

create or replace function public.mutate_landing_page_v1(
  p_operation text,p_page_id uuid,p_expected_revision bigint,p_request_id uuid,p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare p public.landing_pages%rowtype; v public.landing_page_versions%rowtype;
  v_meta jsonb; v_content jsonb; v_images jsonb; v_hash text; v_receipt record;
  v_response jsonb; v_number integer; v_revision bigint; v_operation text;
  v_id uuid; v_slug text; v_brand uuid; v_form uuid; v_title text;
begin
  if p_operation is null or p_operation not in ('create','save','publish','archive','restore','delete')
    or p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or octet_length(p_payload::text)>524288 then
    raise exception 'landing_invalid_command' using errcode='22023';
  end if;
  v_operation:='landing_page:'||p_operation;
  v_hash:=encode(pg_catalog.sha256(convert_to(jsonb_build_object('page_id',p_page_id,
    'revision',p_expected_revision,'payload',p_payload)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(v_operation||':'||p_request_id::text,0));
  select request_hash,response_json into v_receipt from public.acquisition_operation_receipts
    where operation=v_operation and request_id=p_request_id;
  if found then
    if v_receipt.request_hash<>v_hash then raise exception 'acquisition_request_conflict' using errcode='22023'; end if;
    return v_receipt.response_json||jsonb_build_object('replayed',true);
  end if;

  if p_operation='create' then
    v_id:=gen_random_uuid();
    v_brand:=(p_payload->>'brand_id')::uuid;
    v_form:=(p_payload->>'form_id')::uuid;
    v_title:=btrim(coalesce(p_payload->>'title',''));
    v_slug:=nullif(btrim(p_payload->>'slug'),'');
    if v_slug is null then
      select b.slug||'-'||substr(replace(p_request_id::text,'-',''),1,12) into v_slug
        from public.brands b where b.id=v_brand;
    end if;
    v_meta:=public.resolve_landing_page_metadata_v1(v_brand,
      p_payload||jsonb_build_object('slug',v_slug,'title',v_title,'form_id',v_form),false);
    v_content:=coalesce(p_payload->'content_json','{}'::jsonb);
    v_images:=coalesce(p_payload->'image_assets_json','{}'::jsonb);
    if jsonb_typeof(v_content)<>'object' or jsonb_typeof(v_images)<>'object' then
      raise exception 'landing_invalid_document' using errcode='22023';
    end if;
    insert into public.landing_pages(id,slug,title,brand_id,treatment_id,package_id,branch_id,
      form_id,template_key,mode,status,content_json,image_assets_json)
    values(v_id,v_meta->>'slug',v_meta->>'title',v_brand,(v_meta->>'treatment_id')::uuid,
      (v_meta->>'package_id')::uuid,(v_meta->>'branch_id')::uuid,v_form,
      v_meta->>'template_key',(v_meta->>'mode')::public.landing_page_mode,'draft',v_content,v_images)
    returning * into p;
    insert into public.landing_page_versions(page_id,version_number,status,content_json,
      image_assets_json,metadata_json,page_revision)
    values(p.id,1,'draft',v_content,v_images,v_meta,p.revision) returning * into v;
  else
    select * into p from public.landing_pages where id=p_page_id for update;
    if not found then raise exception 'landing_page_missing' using errcode='22023'; end if;
    if p_expected_revision is null or p_expected_revision<>p.revision then
      raise exception 'acquisition_revision_conflict' using errcode='40001';
    end if;
    if p_operation in ('archive','restore') then
      update public.landing_pages set status=case when p_operation='archive' then 'archived'::public.landing_page_status
        else 'draft'::public.landing_page_status end,updated_at=clock_timestamp(),revision=p.revision+1
        where id=p.id returning * into p;
    elsif p_operation='delete' then
      if p.status='published' or p.published_version_id is not null
        or exists(select 1 from public.landing_page_versions where page_id=p.id and status='published')
        or exists(select 1 from public.lead_source_snapshots where current_page_url like '%/lp/'||p.slug||'%' or landing_page_url like '%/lp/'||p.slug||'%') then
        raise exception 'landing_delete_has_dependencies' using errcode='23503';
      end if;
      delete from public.landing_pages where id=p.id;
    else
      if p.status='archived' then raise exception 'landing_page_archived' using errcode='22023'; end if;
      select * into v from public.landing_page_versions where page_id=p.id
        order by version_number desc limit 1;
      v_meta:=coalesce(v.metadata_json,'{}'::jsonb)||jsonb_build_object(
        'slug',coalesce(nullif(p_payload->>'slug',''),v.metadata_json->>'slug',p.slug),
        'title',coalesce(nullif(p_payload->>'title',''),v.metadata_json->>'title',p.title),
        'form_id',coalesce(nullif(p_payload->>'form_id',''),v.metadata_json->>'form_id',p.form_id::text));
      v_meta:=public.resolve_landing_page_metadata_v1(p.brand_id,v_meta,p_operation='publish');
      if exists(select 1 from public.landing_pages where slug=v_meta->>'slug' and id<>p.id) then
        raise exception 'landing_slug_conflict' using errcode='23505';
      end if;
      v_content:=coalesce(p_payload->'content_json',v.content_json,p.content_json);
      v_images:=coalesce(p_payload->'image_assets_json',v.image_assets_json,p.image_assets_json);
      if jsonb_typeof(v_content)<>'object' or jsonb_typeof(v_images)<>'object' then
        raise exception 'landing_invalid_document' using errcode='22023';
      end if;
      if p_operation='publish' and (nullif(btrim(v_content->>'heroTitle'),'') is null
        or nullif(btrim(v_content->>'ctaText'),'') is null) then
        raise exception 'landing_publish_content_incomplete' using errcode='22023';
      end if;
      select coalesce(max(version_number),0)+1 into v_number from public.landing_page_versions where page_id=p.id;
      v_revision:=p.revision+1;
      insert into public.landing_page_versions(page_id,version_number,status,content_json,
        image_assets_json,metadata_json,page_revision)
      values(p.id,v_number,case when p_operation='publish' then 'published'::public.landing_page_version_status
        else 'draft'::public.landing_page_version_status end,v_content,v_images,v_meta,v_revision) returning * into v;
      if p_operation='publish' then
        update public.landing_pages set slug=v_meta->>'slug',title=v_meta->>'title',
          form_id=(v_meta->>'form_id')::uuid,treatment_id=(v_meta->>'treatment_id')::uuid,
          package_id=(v_meta->>'package_id')::uuid,branch_id=(v_meta->>'branch_id')::uuid,
          template_key=v_meta->>'template_key',mode=(v_meta->>'mode')::public.landing_page_mode,
          status='published',content_json=v_content,image_assets_json=v_images,
          published_version_id=v.id,published_at=clock_timestamp(),updated_at=clock_timestamp(),revision=v_revision
          where id=p.id returning * into p;
      else
        -- Draft metadata/content lives only in the immutable version. Public row
        -- routing and its approved version pointer are deliberately untouched.
        update public.landing_pages set updated_at=clock_timestamp(),revision=v_revision
          where id=p.id returning * into p;
      end if;
    end if;
  end if;
  v_response:=jsonb_build_object('page',to_jsonb(p),'version',case when v.id is null then null else to_jsonb(v) end,
    'revision',p.revision,'replayed',false,'deleted',p_operation='delete');
  insert into public.acquisition_operation_receipts(operation,request_id,request_hash,response_json)
    values(v_operation,p_request_id,v_hash,v_response);
  return v_response;
end; $$;
revoke all on function public.mutate_landing_page_v1(text,uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_landing_page_v1(text,uuid,bigint,uuid,jsonb) to service_role;

create or replace function public.create_acquisition_assets_v1(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_hash text; v_receipt record; v_form jsonb; v_page jsonb; v_response jsonb;
  v_form_id uuid; v_brand uuid; v_page_input jsonb; f public.forms%rowtype;
begin
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or octet_length(p_payload::text)>524288 then raise exception 'acquisition_invalid_command' using errcode='22023'; end if;
  -- The service adapter resolves these three fields from brand/catalogue defaults;
  -- none is accepted by ManagedFormInput or the browser/server field schema.
  -- Keep all editable business intent in this fingerprint. If conversion or
  -- redirect ever becomes user-editable, it must move into the fingerprint.
  v_hash:=encode(pg_catalog.sha256(convert_to((case when jsonb_typeof(p_payload->'form')='object'
    then jsonb_set(p_payload,'{form}',(p_payload->'form')-array['token_base','conversion_mode','success_redirect_url'])
    else p_payload end)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('create_assets:'||p_request_id::text,0));
  select request_hash,response_json into v_receipt from public.acquisition_operation_receipts
    where operation='create_assets' and request_id=p_request_id;
  if found then
    if v_receipt.request_hash<>v_hash then raise exception 'acquisition_request_conflict' using errcode='22023'; end if;
    return v_receipt.response_json||jsonb_build_object('replayed',true);
  end if;
  if nullif(p_payload->>'existing_form_id','') is not null then
    v_form_id:=(p_payload->>'existing_form_id')::uuid;
    select * into f from public.forms where id=v_form_id for share;
    if not found or f.status<>'active' or f.brand_id is distinct from (p_payload->>'brand_id')::uuid then
      raise exception 'landing_form_inactive_or_unavailable' using errcode='22023';
    end if;
    v_form:=jsonb_build_object('form',to_jsonb(f),'replayed',false);
  else
    v_form:=public.mutate_managed_form_v1('create',null,null,p_request_id,p_payload->'form');
    v_form_id:=(v_form->'form'->>'id')::uuid;
  end if;
  if (v_form->'form'->>'brand_id')::uuid is distinct from (p_payload->>'brand_id')::uuid then
    raise exception 'landing_brand_mismatch' using errcode='22023';
  end if;
  if p_payload->'page' is not null and p_payload->'page'<>'null'::jsonb then
    v_page_input:=(p_payload->'page')||jsonb_build_object('form_id',v_form_id,
      'brand_id',v_form->'form'->'brand_id');
    v_page:=public.mutate_landing_page_v1('create',null,null,p_request_id,v_page_input);
  end if;
  v_response:=jsonb_build_object('form',v_form->'form','page',v_page->'page','version',v_page->'version','replayed',false);
  insert into public.acquisition_operation_receipts(operation,request_id,request_hash,response_json)
    values('create_assets',p_request_id,v_hash,v_response);
  return v_response;
end; $$;
revoke all on function public.create_acquisition_assets_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_acquisition_assets_v1(uuid,jsonb) to service_role;
