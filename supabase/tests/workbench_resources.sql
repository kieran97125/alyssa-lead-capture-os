-- Rollback-only qualification. Requires one fixture personal_workbenches owner.
begin;
do $qa$
declare
  owner_id uuid := (select owner_member_id from public.personal_workbenches order by created_at limit 1);
  source_one uuid := gen_random_uuid(); source_two uuid := gen_random_uuid(); generation uuid := gen_random_uuid();
  file_key text := 'qualification-file-' || source_one::text;
  needle text := '穴位驗收' || source_one::text;
  claim jsonb; result boolean; file_rows jsonb; mount_rows jsonb;
begin
  if owner_id is null then raise exception 'A fixture owner is required'; end if;
  insert into public.workbench_resource_sources(id,owner_member_id,drive_file_id,label,kind,node_ids,content_mode)
  values(source_one,owner_id,'qualification-root-'||source_one::text,'Qualification one','folder',array['node-a'],'documents'),
        (source_two,owner_id,'qualification-root-'||source_two::text,'Qualification two','folder',array['node-b'],'metadata');
  claim:=public.workbench_resource_claim(owner_id,source_one,true);
  if claim is null or public.workbench_resource_claim(owner_id,source_one,true) is not null then raise exception 'Concurrent lease exclusion failed'; end if;
  file_rows:=jsonb_build_array(jsonb_build_object('file_id',file_key,'name','Qualification Brief '||source_one::text,'mime_type','application/vnd.google-apps.document','web_url','https://docs.google.com/document/d/'||file_key||'/edit','modified_time','2026-11-11T00:00:00Z','description','','has_thumbnail',false,'content_version','version-one','indexable',true));
  mount_rows:=jsonb_build_array(jsonb_build_object('file_id',file_key,'parent_id','qualification-root','path','QA/拍攝素材','node_ids',array['node-a']));
  result:=public.workbench_resource_commit(owner_id,source_one,(claim->>'lease_token')::uuid,file_rows,mount_rows,
    jsonb_build_array(jsonb_build_object('file_id',file_key,'content_version','version-one','text_content',needle,'text_state','indexed')),
    jsonb_build_object('generation',generation),'queued','',false,false,false);
  if not result or (public.workbench_resource_search(owner_id,needle,'node-a')->>'total')::integer<>1 then raise exception 'Atomic CJK content search failed'; end if;
  if (public.workbench_resource_search(owner_id,needle,'node-b')->>'total')::integer<>0 or (public.workbench_resource_search(gen_random_uuid(),needle)->>'total')::integer<>0 then raise exception 'Owner/node isolation failed'; end if;
  if (public.workbench_resource_search(owner_id,'wildcard%'||source_one::text)->>'total')::integer<>0 then raise exception 'Literal wildcard escaping failed'; end if;
  if public.workbench_resource_commit(owner_id,source_one,null,'[]','[]','[]','{}','ready','',false,true,false) then raise exception 'Missing lease was accepted'; end if;
  claim:=public.workbench_resource_claim(owner_id,source_one,true);
  if public.workbench_resource_commit(owner_id,source_one,gen_random_uuid(),'[]','[]','[]','{}','ready','',false,true,false) then raise exception 'Stale lease was accepted'; end if;
  update public.workbench_resource_sources set lease_until=now()-interval '1 second' where id=source_one;
  if public.workbench_resource_commit(owner_id,source_one,(claim->>'lease_token')::uuid,'[]','[]','[]','{}','ready','',false,true,false) then raise exception 'Expired lease was accepted'; end if;
  claim:=public.workbench_resource_claim(owner_id,source_two,true);
  mount_rows:=jsonb_build_array(jsonb_build_object('file_id',file_key,'parent_id','qualification-root','path','QA/共享入口','node_ids',array['node-b']));
  result:=public.workbench_resource_commit(owner_id,source_two,(claim->>'lease_token')::uuid,file_rows,mount_rows,'[]',jsonb_build_object('generation',generation),'ready','',false,true,false);
  if not result or (public.workbench_resource_search(owner_id,source_one::text)->>'total')::integer<>1 then raise exception 'Canonical file deduplication failed'; end if;
  if (public.workbench_resource_search(owner_id,needle,'node-b')->>'total')::integer<>0 then raise exception 'Metadata-only membership exposed content search'; end if;
  claim:=public.workbench_resource_claim(owner_id,source_one,true);
  result:=public.workbench_resource_commit(owner_id,source_one,(claim->>'lease_token')::uuid,'[]','[]',jsonb_build_array(jsonb_build_object('file_id',file_key,'content_version','version-one','text_content','','text_state','unavailable','available',false)),jsonb_build_object('generation',generation),'queued','',false,false,false);
  claim:=public.workbench_resource_claim(owner_id,source_one,true);
  result:=public.workbench_resource_commit(owner_id,source_one,(claim->>'lease_token')::uuid,file_rows,'[]','[]',jsonb_build_object('generation',generation),'queued','',false,false,false);
  if not result or (select text_state from public.workbench_resource_files where owner_member_id=owner_id and file_id=file_key)<>'pending' then raise exception 'Restored access did not requeue unchanged content'; end if;
  claim:=public.workbench_resource_claim(owner_id,source_one,true);
  result:=public.workbench_resource_commit(owner_id,source_one,(claim->>'lease_token')::uuid,'[]','[]','[]',jsonb_build_object('generation',gen_random_uuid()),'ready','',true,true,false);
  if not result or (public.workbench_resource_search(owner_id,needle)->>'total')::integer<>0 then raise exception 'Completed-generation membership cleanup failed'; end if;
  if has_table_privilege('authenticated','public.workbench_resource_files','select') or has_function_privilege('anon','public.workbench_resource_search(uuid,text,text,uuid,text,text,integer)','execute') then raise exception 'Index exposed to browser roles'; end if;
end $qa$;
rollback;
