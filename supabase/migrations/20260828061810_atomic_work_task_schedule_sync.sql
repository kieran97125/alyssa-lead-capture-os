-- Update Task Start/Due scheduling and linked unpublished Calendar items in
-- one database transaction. The app still enforces module and brand access
-- before invoking this service-role-only function.

create or replace function public.update_marketing_work_task_schedule(
  task_id_input uuid,
  start_date_input date,
  start_time_input time default null,
  due_date_input date default null,
  due_time_input time default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_task public.marketing_work_tasks%rowtype;
  linked_count integer := 0;
  published_count integer := 0;
  due_changed boolean := false;
begin
  select *
    into current_task
  from public.marketing_work_tasks
  where id = task_id_input
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'task_not_found');
  end if;

  if start_date_input is null then
    return jsonb_build_object('ok', false, 'reason', 'start_date_required');
  end if;

  if due_date_input is not null and due_date_input < start_date_input then
    return jsonb_build_object('ok', false, 'reason', 'due_before_start');
  end if;

  select count(*)::integer
    into linked_count
  from public.marketing_task_calendar_links
  where task_id = task_id_input;

  if linked_count > 0 and due_date_input is null then
    return jsonb_build_object('ok', false, 'reason', 'linked_due_required');
  end if;

  due_changed :=
    current_task.due_date is distinct from due_date_input
    or current_task.due_time is distinct from due_time_input;

  if linked_count > 0 and due_changed then
    select count(*)::integer
      into published_count
    from public.marketing_calendar_items item
    join public.marketing_task_calendar_links link
      on link.calendar_item_id = item.id
    where link.task_id = task_id_input
      and item.status = 'published';

    if published_count > 0 then
      return jsonb_build_object(
        'ok', false,
        'reason', 'published_calendar_immutable',
        'publishedCount', published_count
      );
    end if;
  end if;

  update public.marketing_work_tasks
  set
    start_date = start_date_input,
    start_time = start_time_input,
    due_date = due_date_input,
    due_time = due_time_input,
    updated_at = now()
  where id = task_id_input;

  if linked_count > 0 and due_changed then
    update public.marketing_calendar_items item
    set
      scheduled_date = due_date_input,
      scheduled_time = due_time_input,
      updated_at = now()
    where item.id in (
      select link.calendar_item_id
      from public.marketing_task_calendar_links link
      where link.task_id = task_id_input
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'linkedCount', linked_count,
    'dueChanged', due_changed
  );
end;
$$;

revoke all on function public.update_marketing_work_task_schedule(
  uuid,
  date,
  time,
  date,
  time
) from public, anon, authenticated;
grant execute on function public.update_marketing_work_task_schedule(
  uuid,
  date,
  time,
  date,
  time
) to service_role;
