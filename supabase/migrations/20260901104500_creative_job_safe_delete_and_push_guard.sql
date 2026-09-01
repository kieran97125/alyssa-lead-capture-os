-- Complete the Creative Job soft-delete lifecycle atomically.
-- Daily work disappears, queued reminders are retired, unpublished Calendar
-- drafts are removed, while published history and Audit evidence remain.

create or replace function public.soft_delete_creative_job_and_retire_notifications(
  p_job_id uuid
)
returns table (
  deleted_at timestamptz,
  retired_notification_count integer,
  cancelled_delivery_count integer,
  calendar_item_removed boolean,
  published_calendar_preserved boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_at timestamptz := now();
  v_calendar_item_id uuid;
  v_calendar_status text;
  v_retired_notification_count integer := 0;
  v_cancelled_delivery_count integer := 0;
  v_calendar_item_removed boolean := false;
  v_published_calendar_preserved boolean := false;
begin
  select job.calendar_item_id
    into v_calendar_item_id
  from public.creative_jobs job
  where job.id = p_job_id
    and job.deleted_at is null
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'creative_job_not_found_or_already_deleted';
  end if;

  if v_calendar_item_id is not null then
    select item.status
      into v_calendar_status
    from public.marketing_calendar_items item
    where item.id = v_calendar_item_id
    for update;

    if found and v_calendar_status = 'published' then
      v_published_calendar_preserved := true;
    elsif found then
      delete from public.marketing_calendar_items item
      where item.id = v_calendar_item_id;
      v_calendar_item_removed := found;
    end if;
  end if;

  update public.marketing_web_push_deliveries delivery
  set
    status = 'failed',
    next_attempt_at = v_deleted_at,
    last_error = 'creative_job_deleted',
    updated_at = v_deleted_at
  where delivery.notification_id in (
    select notification.id
    from public.marketing_notifications notification
    where notification.creative_job_id = p_job_id
  )
    and delivery.status in ('pending', 'retry', 'sending');
  get diagnostics v_cancelled_delivery_count = row_count;

  update public.marketing_notifications notification
  set
    is_read = true,
    read_at = coalesce(notification.read_at, v_deleted_at)
  where notification.creative_job_id = p_job_id
    and notification.is_read = false;
  get diagnostics v_retired_notification_count = row_count;

  update public.creative_jobs job
  set
    deleted_at = v_deleted_at,
    updated_at = v_deleted_at
  where job.id = p_job_id
    and job.deleted_at is null;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'creative_job_not_found_or_already_deleted';
  end if;

  return query
  select
    v_deleted_at,
    v_retired_notification_count,
    v_cancelled_delivery_count,
    v_calendar_item_removed,
    v_published_calendar_preserved;
end;
$$;

revoke all on function public.soft_delete_creative_job_and_retire_notifications(uuid)
  from public, anon, authenticated;
grant execute on function public.soft_delete_creative_job_and_retire_notifications(uuid)
  to service_role;

-- Do not claim a queued delivery when its Creative Job was already deleted.
-- The dispatcher also performs an application-level guard for deliveries that
-- were claimed immediately before the delete transaction committed.
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
    join public.marketing_notifications notification
      on notification.id = delivery.notification_id
    left join public.creative_jobs job
      on job.id = notification.creative_job_id
    where delivery.status in ('pending', 'retry')
      and delivery.next_attempt_at <= now()
      and (
        notification.creative_job_id is null
        or job.deleted_at is null
      )
    order by delivery.created_at
    for update of delivery skip locked
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
