-- Disambiguate the lease record from joined source aliases; reject missing leases.
create or replace function public.workbench_resource_commit(p_owner uuid,p_source uuid,p_lease uuid,p_files jsonb,p_mounts jsonb,p_texts jsonb,p_cursor jsonb,p_status text,p_error text,p_prune boolean default false,p_complete boolean default false,p_hide boolean default false)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_source public.workbench_resource_sources;
begin
  select * into current_source from public.workbench_resource_sources where owner_member_id=p_owner and id=p_source for update;
  if not found or p_lease is null or current_source.lease_token is null or current_source.lease_until is null or current_source.lease_token is distinct from p_lease or current_source.lease_until<now() then return false; end if;
  insert into public.workbench_resource_files as f(owner_member_id,file_id,name,mime_type,web_url,modified_time,size,description,has_thumbnail,content_version,text_state)
  select p_owner,x.file_id,x.name,x.mime_type,x.web_url,x.modified_time,x.size,coalesce(x.description,''),coalesce(x.has_thumbnail,false),x.content_version,case when x.indexable then 'pending' else 'metadata' end
  from jsonb_to_recordset(p_files) as x(file_id text,name text,mime_type text,web_url text,modified_time timestamptz,size bigint,description text,has_thumbnail boolean,content_version text,indexable boolean)
  on conflict(owner_member_id,file_id) do update set name=excluded.name,mime_type=excluded.mime_type,web_url=excluded.web_url,modified_time=excluded.modified_time,size=excluded.size,description=excluded.description,has_thumbnail=excluded.has_thumbnail,available=true,
    text_content=case when f.content_version<>excluded.content_version then '' else f.text_content end,
    text_state=case when f.content_version<>excluded.content_version then excluded.text_state when f.text_state='metadata' and excluded.text_state='pending' then 'pending' else f.text_state end,
    content_version=excluded.content_version,updated_at=now();
  insert into public.workbench_resource_mounts(owner_member_id,source_id,file_id,parent_id,path,node_ids,generation,available)
  select p_owner,p_source,x.file_id,x.parent_id,x.path,x.node_ids,(p_cursor->>'generation')::uuid,true
  from jsonb_to_recordset(p_mounts) as x(file_id text,parent_id text,path text,node_ids text[])
  on conflict(owner_member_id,source_id,file_id) do update set parent_id=excluded.parent_id,path=excluded.path,node_ids=excluded.node_ids,generation=excluded.generation,available=true;
  update public.workbench_resource_files f set text_content=x.text_content,text_state=x.text_state,text_error=coalesce(x.text_error,''),available=coalesce(x.available,f.available),updated_at=now()
  from jsonb_to_recordset(p_texts) as x(file_id text,content_version text,text_content text,text_state text,text_error text,available boolean)
  where f.owner_member_id=p_owner and f.file_id=x.file_id and f.content_version=x.content_version;
  if p_prune then update public.workbench_resource_mounts set available=false where owner_member_id=p_owner and source_id=p_source and generation<>(p_cursor->>'generation')::uuid; end if;
  if p_hide then update public.workbench_resource_mounts set available=false where owner_member_id=p_owner and source_id=p_source; end if;
  update public.workbench_resource_files f set available=false,text_content='',text_state='metadata' where f.owner_member_id=p_owner and not exists(select 1 from public.workbench_resource_mounts m join public.workbench_resource_sources s on s.owner_member_id=m.owner_member_id and s.id=m.source_id where m.owner_member_id=p_owner and m.file_id=f.file_id and m.available and s.enabled);
  update public.workbench_resource_sources set cursor=case when p_complete then '{}'::jsonb else p_cursor end,status=p_status,last_error=left(p_error,800),lease_token=null,lease_until=null,
    last_synced_at=case when p_complete then now() else last_synced_at end,
    next_sync_at=now()+case when p_complete then interval '15 minutes' when p_status='queued' then interval '2 seconds' else interval '2 minutes' end,
    file_count=(select count(*) from public.workbench_resource_mounts m where m.owner_member_id=p_owner and m.source_id=p_source and m.available),updated_at=now()
  where owner_member_id=p_owner and id=p_source;
  return true;
end; $$;
