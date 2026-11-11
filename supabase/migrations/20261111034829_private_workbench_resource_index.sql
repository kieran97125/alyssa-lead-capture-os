-- Private, owner-scoped resource index. Operational Sheets remain metadata-only.
create extension if not exists pg_trgm with schema extensions;
create table public.workbench_resource_sources (
  id uuid primary key default gen_random_uuid(),
  owner_member_id uuid not null references public.personal_workbenches(owner_member_id) on delete cascade,
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  label text not null check (length(label) between 1 and 160),
  kind text not null check (kind in ('folder','file')),
  node_ids text[] not null default '{}', folder_bindings jsonb not null default '[]',
  content_mode text not null default 'metadata' check (content_mode in ('metadata','documents')),
  enabled boolean not null default true,
  status text not null default 'queued' check (status in ('queued','syncing','ready','partial','error','auth_required')),
  cursor jsonb not null default '{}', lease_token uuid, lease_until timestamptz,
  next_sync_at timestamptz not null default now(), last_started_at timestamptz, last_synced_at timestamptz,
  last_error text not null default '', file_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (owner_member_id, drive_file_id), unique (owner_member_id, id)
);
create index workbench_resource_sources_due on public.workbench_resource_sources(next_sync_at) where enabled;
create table public.workbench_resource_files (
  owner_member_id uuid not null references public.personal_workbenches(owner_member_id) on delete cascade,
  file_id text not null, name text not null, mime_type text not null, web_url text not null,
  modified_time timestamptz, size bigint, description text not null default '', has_thumbnail boolean not null default false,
  available boolean not null default true, content_version text not null default '',
  text_content text not null default '' check(length(text_content)<=60000),
  text_state text not null default 'metadata' check(text_state in ('metadata','pending','indexed','truncated','empty','unavailable')),
  text_error text not null default '', updated_at timestamptz not null default now(),
  searchable text generated always as (lower(name || ' ' || description || ' ' || text_content)) stored,
  primary key (owner_member_id, file_id)
);
create index workbench_resource_files_search on public.workbench_resource_files using gin(searchable extensions.gin_trgm_ops);
create index workbench_resource_files_recent on public.workbench_resource_files(owner_member_id, modified_time desc);
create table public.workbench_resource_mounts (
  owner_member_id uuid not null, source_id uuid not null, file_id text not null,
  parent_id text, path text not null, node_ids text[] not null default '{}',
  generation uuid not null, available boolean not null default true,
  primary key(owner_member_id,source_id,file_id),
  foreign key(owner_member_id,source_id) references public.workbench_resource_sources(owner_member_id,id) on delete cascade,
  foreign key(owner_member_id,file_id) references public.workbench_resource_files(owner_member_id,file_id) on delete cascade
);
create index workbench_resource_mounts_file on public.workbench_resource_mounts(owner_member_id,file_id);
create index workbench_resource_mounts_nodes on public.workbench_resource_mounts using gin(node_ids);
create index workbench_resource_mounts_parent on public.workbench_resource_mounts(owner_member_id,parent_id);
alter table public.workbench_resource_sources enable row level security;
alter table public.workbench_resource_files enable row level security;
alter table public.workbench_resource_mounts enable row level security;
revoke all on public.workbench_resource_sources,public.workbench_resource_files,public.workbench_resource_mounts from public,anon,authenticated;
grant select,insert,update,delete on public.workbench_resource_sources,public.workbench_resource_files,public.workbench_resource_mounts to service_role;

create function public.workbench_resource_claim(p_owner uuid,p_source uuid,p_force boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
  update public.workbench_resource_sources s set lease_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',status='syncing',last_started_at=case when cursor='{}'::jsonb then now() else coalesce(last_started_at,now()) end
  where s.owner_member_id=p_owner and s.id=p_source and s.enabled
    and (s.lease_until is null or s.lease_until<now())
    and (p_force or s.next_sync_at<=now() or s.cursor<>'{}'::jsonb)
  returning to_jsonb(s) into result;
  return result;
end; $$;

create function public.workbench_resource_commit(p_owner uuid,p_source uuid,p_lease uuid,p_files jsonb,p_mounts jsonb,p_texts jsonb,p_cursor jsonb,p_status text,p_error text,p_prune boolean default false,p_complete boolean default false,p_hide boolean default false)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.workbench_resource_sources;
begin
  select * into s from public.workbench_resource_sources where owner_member_id=p_owner and id=p_source for update;
  if not found or s.lease_token is distinct from p_lease or s.lease_until<now() then return false; end if;
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

create function public.workbench_resource_search(p_owner uuid,p_query text default '',p_node text default '',p_source uuid default null,p_kind text default 'all',p_parent text default null,p_page integer default 0)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
with eligible as (
  select m.*,s.label,s.content_mode from public.workbench_resource_mounts m join public.workbench_resource_sources s on s.owner_member_id=m.owner_member_id and s.id=m.source_id
  where m.owner_member_id=p_owner and m.available and s.enabled and (p_source is null or s.id=p_source) and (p_node in ('','core') or p_node=any(m.node_ids)) and (p_parent is null or m.parent_id=p_parent)
), hits as (
  select f.* from public.workbench_resource_files f where f.owner_member_id=p_owner and f.available and exists(select 1 from eligible e where e.file_id=f.file_id)
  and (p_query='' or lower(f.name || ' ' || f.description) like '%'||lower(replace(replace(replace(left(p_query,120),'\','\\'),'%','\%'),'_','\_'))||'%' escape '\' or exists(select 1 from eligible e where e.file_id=f.file_id and (e.path ilike '%'||replace(replace(replace(left(p_query,120),'\','\\'),'%','\%'),'_','\_')||'%' escape '\' or (e.content_mode='documents' and f.searchable like '%'||lower(replace(replace(replace(left(p_query,120),'\','\\'),'%','\%'),'_','\_'))||'%' escape '\'))))
  and (p_kind='all' or p_kind='folder' and f.mime_type='application/vnd.google-apps.folder' or p_kind='image' and f.mime_type like 'image/%' or p_kind='video' and f.mime_type like 'video/%' or p_kind='sheet' and f.mime_type~'(spreadsheet|excel|csv)' or p_kind='slides' and f.mime_type~'(presentation|powerpoint)' or p_kind='pdf' and f.mime_type='application/pdf' or p_kind='document' and f.mime_type in ('application/vnd.google-apps.document','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
), paged as (select * from hits order by modified_time desc nulls last,name,file_id limit 40 offset greatest(0,least(p_page,10000))*40)
select jsonb_build_object('total',(select count(*) from hits),'page',greatest(0,p_page),'pageSize',40,'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.file_id,'name',f.name,'mimeType',f.mime_type,'url',f.web_url,'modifiedAt',f.modified_time,'size',f.size,'hasThumbnail',f.has_thumbnail,'textState',f.text_state,
 'paths',(select jsonb_agg(distinct e.path) from eligible e where e.file_id=f.file_id),
 'sourceIds',(select jsonb_agg(distinct e.source_id) from eligible e where e.file_id=f.file_id),
 'nodeIds',(select jsonb_agg(distinct n) from eligible e cross join lateral unnest(e.node_ids) n where e.file_id=f.file_id),
 'snippet',case when p_query<>'' and exists(select 1 from eligible e where e.file_id=f.file_id and e.content_mode='documents') then substring(f.text_content from greatest(1,position(lower(p_query) in lower(f.text_content))-60) for 200) else '' end
 ) order by f.modified_time desc nulls last,f.name,f.file_id) from paged f),'[]'::jsonb)); $$;

create function public.workbench_resource_overview(p_owner uuid)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
with eligible as (select f.* from public.workbench_resource_files f where f.owner_member_id=p_owner and f.available and exists(select 1 from public.workbench_resource_mounts m join public.workbench_resource_sources s on s.owner_member_id=m.owner_member_id and s.id=m.source_id where m.owner_member_id=p_owner and m.file_id=f.file_id and m.available and s.enabled))
select jsonb_build_object('sources',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'driveFileId',s.drive_file_id,'kind',s.kind,'nodeIds',s.node_ids,'enabled',s.enabled,'contentMode',s.content_mode,'status',s.status,'fileCount',s.file_count,'lastSyncedAt',s.last_synced_at,'lastError',s.last_error,'updatedAt',s.updated_at) order by s.label) from public.workbench_resource_sources s where s.owner_member_id=p_owner),'[]'::jsonb),
 'total',(select count(*) from eligible),
 'indexed',(select count(*) from eligible where text_state in ('indexed','truncated')),
 'pending',(select count(*) from eligible where text_state='pending'),'checkedAt',now()); $$;

revoke all on function public.workbench_resource_claim(uuid,uuid,boolean),public.workbench_resource_commit(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,boolean,boolean,boolean),public.workbench_resource_search(uuid,text,text,uuid,text,text,integer),public.workbench_resource_overview(uuid) from public,anon,authenticated;
grant execute on function public.workbench_resource_claim(uuid,uuid,boolean),public.workbench_resource_commit(uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb,text,text,boolean,boolean,boolean),public.workbench_resource_search(uuid,text,text,uuid,text,text,integer),public.workbench_resource_overview(uuid) to service_role;
