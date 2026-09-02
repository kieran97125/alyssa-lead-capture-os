-- Editable Marketing Calendar Items
-- Atomically updates a Calendar item and all operational records that own
-- the same publish schedule. App-server permission and brand checks remain
-- mandatory before the service-role RPC is called.

create or replace function public.update_marketing_calendar_item_with_links(
  p_item_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb,
  p_actor_member_id uuid,
  p_actor_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.marketing_calendar_items%rowtype;
  v_updated public.marketing_calendar_items%rowtype;
  v_brand_id uuid;
  v_treatment_id uuid;
  v_treatment_label text;
  v_title text;
  v_item_type text;
  v_channel text;
  v_status text;
  v_scheduled_date date;
  v_scheduled_time time;
  v_assignee_email text;
  v_assignee_member_id uuid;
  v_notes text;
  v_show_on_timeline boolean;
  v_linked_task_count integer := 0;
  v_linked_creative_count integer := 0;
begin
  if p_item_id is null or p_payload is null then
    raise exception using errcode = '22023', message = 'invalid_calendar_item_payload';
  end if;

  select * into v_existing
  from public.marketing_calendar_items
  where id = p_item_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'calendar_item_not_found';
  end if;

  if p_expected_updated_at is not null
     and v_existing.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'stale_calendar_item';
  end if;

  begin
    v_brand_id := nullif(p_payload ->> 'brandId', '')::uuid;
    v_treatment_id := nullif(p_payload ->> 'treatmentId', '')::uuid;
    v_title := btrim(coalesce(p_payload ->> 'title', ''));
    v_item_type := coalesce(nullif(p_payload ->> 'itemType', ''), 'post');
    v_channel := nullif(btrim(coalesce(p_payload ->> 'channel', '')), '');
    v_status := coalesce(nullif(p_payload ->> 'status', ''), 'idea');
    v_scheduled_date := nullif(p_payload ->> 'scheduledDate', '')::date;
    v_scheduled_time := nullif(p_payload ->> 'scheduledTime', '')::time;
    v_assignee_email := nullif(lower(btrim(coalesce(p_payload ->> 'assigneeEmail', ''))), '');
    v_notes := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
    v_show_on_timeline := coalesce(
      (p_payload ->> 'showOnPerformanceTimeline')::boolean,
      true
    );
  exception when others then
    raise exception using errcode = '22023', message = 'invalid_calendar_item_payload';
  end;

  if v_brand_id is null
     or v_scheduled_date is null
     or char_length(v_title) not between 1 and 180
     or v_item_type not in ('post', 'ad', 'landing_page', 'email', 'meeting', 'task')
     or v_status not in ('idea', 'scheduled', 'published')
     or coalesce(char_length(v_channel), 0) > 120
     or coalesce(char_length(v_assignee_email), 0) > 320
     or coalesce(char_length(v_notes), 0) > 4000 then
    raise exception using errcode = '22023', message = 'invalid_calendar_item_payload';
  end if;

  if not exists (select 1 from public.brands where id = v_brand_id) then
    raise exception using errcode = '23503', message = 'calendar_brand_not_found';
  end if;

  if v_treatment_id is not null then
    select treatment.name into v_treatment_label
    from public.treatments treatment
    where treatment.id = v_treatment_id
      and treatment.brand_id = v_brand_id;
    if not found then
      raise exception using errcode = '23514', message = 'calendar_treatment_brand_mismatch';
    end if;
  else
    v_treatment_label := null;
  end if;

  if exists (
    select 1
    from public.marketing_task_calendar_links link
    join public.marketing_work_tasks task on task.id = link.task_id
    where link.calendar_item_id = p_item_id
      and task.start_date > v_scheduled_date
  ) then
    raise exception using errcode = '23514', message = 'calendar_before_linked_task_start';
  end if;

  if exists (
    select 1
    from public.creative_jobs job
    where job.calendar_item_id = p_item_id
      and job.deleted_at is null
      and job.due_date is not null
      and job.due_date > v_scheduled_date
  ) then
    raise exception using errcode = '23514', message = 'calendar_before_creative_due';
  end if;

  select member.id into v_assignee_member_id
  from public.workspace_members member
  where v_assignee_email is not null
    and lower(member.email) = v_assignee_email
    and member.status = 'active'
    and (
      member.is_master
      or exists (
        select 1
        from public.workspace_member_brand_access access
        where access.member_id = member.id
          and access.brand_id = v_brand_id
          and access.status = 'active'
      )
    )
  order by member.is_master desc
  limit 1;

  update public.marketing_calendar_items
  set
    brand_id = v_brand_id,
    treatment_id = v_treatment_id,
    treatment_label = v_treatment_label,
    title = v_title,
    item_type = v_item_type,
    channel = v_channel,
    status = v_status,
    scheduled_date = v_scheduled_date,
    scheduled_time = v_scheduled_time,
    assignee_email = v_assignee_email,
    notes = v_notes,
    show_on_performance_timeline = v_show_on_timeline,
    published_at = case
      when v_status = 'published' and v_existing.status = 'published'
        then coalesce(v_existing.published_at, now())
      when v_status = 'published'
        then now()
      else null
    end,
    auto_published_at = case
      when v_status = 'published' and v_existing.status = 'published'
        then v_existing.auto_published_at
      else null
    end,
    updated_at = now()
  where id = p_item_id
  returning * into v_updated;

  insert into public.marketing_command_center_audit (
    actor_email,
    action,
    entity_type,
    entity_id,
    brand_id,
    before_json,
    after_json
  ) values (
    nullif(btrim(coalesce(p_actor_email, '')), ''),
    'calendar_item.updated',
    'marketing_calendar_item',
    p_item_id::text,
    v_brand_id,
    jsonb_build_object(
      'brandId', v_existing.brand_id,
      'treatmentId', v_existing.treatment_id,
      'treatmentLabel', v_existing.treatment_label,
      'title', v_existing.title,
      'itemType', v_existing.item_type,
      'channel', v_existing.channel,
      'status', v_existing.status,
      'scheduledDate', v_existing.scheduled_date,
      'scheduledTime', v_existing.scheduled_time,
      'assigneeEmail', v_existing.assignee_email,
      'notes', v_existing.notes,
      'showOnPerformanceTimeline', v_existing.show_on_performance_timeline,
      'updatedAt', v_existing.updated_at
    ),
    jsonb_build_object(
      'brandId', v_updated.brand_id,
      'treatmentId', v_updated.treatment_id,
      'treatmentLabel', v_updated.treatment_label,
      'title', v_updated.title,
      'itemType', v_updated.item_type,
      'channel', v_updated.channel,
      'status', v_updated.status,
      'scheduledDate', v_updated.scheduled_date,
      'scheduledTime', v_updated.scheduled_time,
      'assigneeEmail', v_updated.assignee_email,
      'notes', v_updated.notes,
      'showOnPerformanceTimeline', v_updated.show_on_performance_timeline,
      'updatedAt', v_updated.updated_at
    )
  );

  update public.marketing_work_tasks task
  set
    brand_id = v_brand_id,
    treatment_id = v_treatment_id,
    treatment_label = v_treatment_label,
    title = v_title,
    description = v_notes,
    assignee_member_id = v_assignee_member_id,
    assignee_email = v_assignee_email,
    due_date = v_scheduled_date,
    due_time = v_scheduled_time,
    updated_at = now()
  where task.id in (
    select link.task_id
    from public.marketing_task_calendar_links link
    where link.calendar_item_id = p_item_id
  );
  get diagnostics v_linked_task_count = row_count;

  insert into public.creative_job_audit (
    job_id,
    actor_member_id,
    actor_email,
    action,
    before_json,
    after_json
  )
  select
    job.id,
    p_actor_member_id,
    nullif(btrim(coalesce(p_actor_email, '')), ''),
    'calendar_item.updated',
    jsonb_build_object(
      'brandId', job.brand_id,
      'treatmentId', job.treatment_id,
      'treatmentLabel', job.treatment_label,
      'title', job.title,
      'publishDate', job.publish_date,
      'publishTime', job.publish_time
    ),
    jsonb_build_object(
      'brandId', v_brand_id,
      'treatmentId', v_treatment_id,
      'treatmentLabel', v_treatment_label,
      'title', v_title,
      'publishDate', v_scheduled_date,
      'publishTime', v_scheduled_time
    )
  from public.creative_jobs job
  where job.calendar_item_id = p_item_id
    and job.deleted_at is null;

  update public.creative_jobs job
  set
    brand_id = v_brand_id,
    treatment_id = v_treatment_id,
    treatment_label = v_treatment_label,
    title = v_title,
    publish_date = v_scheduled_date,
    publish_time = v_scheduled_time,
    sync_calendar = true,
    updated_at = now()
  where job.calendar_item_id = p_item_id
    and job.deleted_at is null;
  get diagnostics v_linked_creative_count = row_count;

  return jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_updated.id,
      'brandId', v_updated.brand_id,
      'treatmentId', v_updated.treatment_id,
      'treatmentLabel', v_updated.treatment_label,
      'title', v_updated.title,
      'itemType', v_updated.item_type,
      'channel', v_updated.channel,
      'status', v_updated.status,
      'scheduledDate', v_updated.scheduled_date,
      'scheduledTime', v_updated.scheduled_time,
      'assigneeEmail', v_updated.assignee_email,
      'notes', v_updated.notes,
      'sortOrder', v_updated.sort_order,
      'showOnPerformanceTimeline', v_updated.show_on_performance_timeline,
      'updatedAt', v_updated.updated_at
    ),
    'linkedTaskCount', v_linked_task_count,
    'linkedCreativeJobCount', v_linked_creative_count
  );
end;
$$;

revoke all on function public.update_marketing_calendar_item_with_links(
  uuid, timestamptz, jsonb, uuid, text
) from public, anon, authenticated;
grant execute on function public.update_marketing_calendar_item_with_links(
  uuid, timestamptz, jsonb, uuid, text
) to service_role;

comment on function public.update_marketing_calendar_item_with_links(
  uuid, timestamptz, jsonb, uuid, text
) is
  'Atomically edits a Marketing Calendar item, linked Weekly Task metadata, linked Creative Job publish ownership, operational events and audit history.';
