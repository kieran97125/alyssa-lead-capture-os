-- Atomically claim Web Push deliveries so trigger-driven and cron-driven
-- dispatchers cannot send the same notification twice.

create or replace function public.claim_marketing_web_push_deliveries(
  batch_size integer default 50
)
returns table (
  id uuid,
  notification_id uuid,
  subscription_id uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with candidates as (
    select delivery.id
    from public.marketing_web_push_deliveries delivery
    where delivery.status in ('pending', 'retry')
      and delivery.next_attempt_at <= now()
    order by delivery.created_at
    for update skip locked
    limit greatest(1, least(coalesce(batch_size, 50), 100))
  ), claimed as (
    update public.marketing_web_push_deliveries delivery
    set
      status = 'sending',
      attempt_count = delivery.attempt_count + 1,
      updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning
      delivery.id,
      delivery.notification_id,
      delivery.subscription_id,
      delivery.attempt_count
  )
  select
    claimed.id,
    claimed.notification_id,
    claimed.subscription_id,
    claimed.attempt_count
  from claimed;
end;
$$;

revoke all on function public.claim_marketing_web_push_deliveries(integer)
  from public, anon, authenticated;
grant execute on function public.claim_marketing_web_push_deliveries(integer)
  to service_role;

create or replace function public.queue_work_task_reminders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  queued_count integer := 0;
  inserted_count integer := 0;
  hk_today date := (now() at time zone 'Asia/Hong_Kong')::date;
begin
  insert into public.marketing_notifications (
    recipient_member_id,
    recipient_email,
    brand_id,
    task_id,
    notification_type,
    title,
    body,
    dedupe_key
  )
  select
    task.assignee_member_id,
    task.assignee_email,
    task.brand_id,
    task.id,
    'task_starting',
    '今日開始工作',
    task.title,
    'task_starting:' || task.id::text || ':' || task.start_date::text
  from public.marketing_work_tasks task
  where task.status <> 'done'
    and task.assignee_member_id is not null
    and task.start_date = hk_today
    and (
      (task.start_date + coalesce(task.start_time, time '09:00'))
      at time zone 'Asia/Hong_Kong'
    ) <= now()
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  queued_count := queued_count + inserted_count;

  insert into public.marketing_notifications (
    recipient_member_id,
    recipient_email,
    brand_id,
    task_id,
    notification_type,
    title,
    body,
    dedupe_key
  )
  select
    task.assignee_member_id,
    task.assignee_email,
    task.brand_id,
    task.id,
    'task_due_soon',
    '工作將於 24 小時內到期',
    task.title,
    'task_due_soon:' || task.id::text || ':' || task.due_date::text || ':' || coalesce(task.due_time::text, '12:00')
  from public.marketing_work_tasks task
  where task.status <> 'done'
    and task.assignee_member_id is not null
    and task.due_date is not null
    and (
      (task.due_date + coalesce(task.due_time, time '12:00'))
      at time zone 'Asia/Hong_Kong'
    ) > now()
    and (
      (task.due_date + coalesce(task.due_time, time '12:00'))
      at time zone 'Asia/Hong_Kong'
    ) <= now() + interval '24 hours'
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  queued_count := queued_count + inserted_count;

  insert into public.marketing_notifications (
    recipient_member_id,
    recipient_email,
    brand_id,
    task_id,
    notification_type,
    title,
    body,
    dedupe_key
  )
  select
    task.assignee_member_id,
    task.assignee_email,
    task.brand_id,
    task.id,
    'task_overdue',
    '工作已逾期',
    task.title,
    'task_overdue:' || task.id::text || ':' || task.due_date::text || ':' || coalesce(task.due_time::text, '12:00')
  from public.marketing_work_tasks task
  where task.status <> 'done'
    and task.assignee_member_id is not null
    and task.due_date is not null
    and task.due_date >= hk_today - 7
    and (
      (task.due_date + coalesce(task.due_time, time '12:00'))
      at time zone 'Asia/Hong_Kong'
    ) <= now()
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  queued_count := queued_count + inserted_count;

  return queued_count;
end;
$$;

revoke all on function public.queue_work_task_reminders()
  from public, anon, authenticated;
grant execute on function public.queue_work_task_reminders() to service_role;
