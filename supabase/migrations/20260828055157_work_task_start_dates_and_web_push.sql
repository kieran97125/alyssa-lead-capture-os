-- Separate task start scheduling from due / publish scheduling and add
-- production-grade browser push delivery infrastructure.

create extension if not exists pg_net;

alter table public.marketing_work_tasks
  add column if not exists start_date date,
  add column if not exists start_time time;

update public.marketing_work_tasks
set start_date = coalesce(
  start_date,
  due_date,
  (created_at at time zone 'Asia/Hong_Kong')::date
)
where start_date is null;

alter table public.marketing_work_tasks
  alter column start_date set not null,
  alter column start_date set default ((now() at time zone 'Asia/Hong_Kong')::date);

alter table public.marketing_work_tasks
  drop constraint if exists marketing_work_tasks_start_due_check;
alter table public.marketing_work_tasks
  add constraint marketing_work_tasks_start_due_check
  check (due_date is null or due_date >= start_date);

create index if not exists marketing_work_tasks_brand_start_idx
  on public.marketing_work_tasks(brand_id, start_date, status);
create index if not exists marketing_work_tasks_assignee_start_idx
  on public.marketing_work_tasks(assignee_member_id, start_date, status);

create table if not exists public.marketing_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.workspace_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  content_encoding text not null default 'aes128gcm'
    check (content_encoding = 'aes128gcm'),
  user_agent text,
  device_label text,
  is_active boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_web_push_endpoint_length_check
    check (char_length(endpoint) between 20 and 4096),
  constraint marketing_web_push_key_length_check
    check (
      char_length(p256dh) between 20 and 512
      and char_length(auth) between 8 and 256
    ),
  constraint marketing_web_push_user_agent_length_check
    check (user_agent is null or char_length(user_agent) <= 500),
  constraint marketing_web_push_device_label_length_check
    check (device_label is null or char_length(device_label) <= 120)
);

create index if not exists marketing_web_push_subscriptions_member_idx
  on public.marketing_web_push_subscriptions(member_id, is_active, last_seen_at desc);
alter table public.marketing_web_push_subscriptions enable row level security;

create table if not exists public.marketing_web_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.marketing_notifications(id) on delete cascade,
  subscription_id uuid not null references public.marketing_web_push_subscriptions(id) on delete cascade,
  status text not null default 'pending'
    check (
      status = any (
        array[
          'pending'::text,
          'sending'::text,
          'retry'::text,
          'sent'::text,
          'gone'::text,
          'failed'::text
        ]
      )
    ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  response_status integer,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id, subscription_id),
  constraint marketing_web_push_delivery_error_length_check
    check (last_error is null or char_length(last_error) <= 1000)
);

create index if not exists marketing_web_push_deliveries_pending_idx
  on public.marketing_web_push_deliveries(status, next_attempt_at, created_at)
  where status in ('pending', 'retry');
alter table public.marketing_web_push_deliveries enable row level security;

create table if not exists public.marketing_web_push_settings (
  id text primary key default 'primary' check (id = 'primary'),
  vapid_public_key text not null,
  vapid_private_key text not null,
  vapid_subject text not null,
  dispatch_url text not null,
  dispatch_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_web_push_settings_key_length_check
    check (
      char_length(vapid_public_key) between 40 and 256
      and char_length(vapid_private_key) between 20 and 256
    ),
  constraint marketing_web_push_settings_subject_check
    check (vapid_subject ~ '^(mailto:|https://)'),
  constraint marketing_web_push_settings_dispatch_url_check
    check (dispatch_url ~ '^https://'),
  constraint marketing_web_push_settings_token_check
    check (char_length(dispatch_token) >= 32)
);
alter table public.marketing_web_push_settings enable row level security;

revoke all on table public.marketing_web_push_subscriptions from anon, authenticated;
revoke all on table public.marketing_web_push_deliveries from anon, authenticated;
revoke all on table public.marketing_web_push_settings from anon, authenticated;
grant select, insert, update, delete on table public.marketing_web_push_subscriptions to service_role;
grant select, insert, update, delete on table public.marketing_web_push_deliveries to service_role;
grant select, insert, update, delete on table public.marketing_web_push_settings to service_role;

create or replace function public.request_marketing_web_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  target_url text;
  target_token text;
  request_id bigint;
begin
  select dispatch_url, dispatch_token
    into target_url, target_token
  from public.marketing_web_push_settings
  where id = 'primary';

  if target_url is null or target_token is null then
    return null;
  end if;

  select net.http_post(
    url := target_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-growth-os-dispatch-token', target_token
    ),
    body := jsonb_build_object(
      'source', 'growth-os-postgres',
      'requestedAt', now()
    ),
    timeout_milliseconds := 15000
  ) into request_id;

  return request_id;
exception
  when others then
    raise warning 'marketing_web_push_dispatch_request_failed: %', sqlerrm;
    return null;
end;
$$;

revoke all on function public.request_marketing_web_push_dispatch() from public, anon, authenticated;
grant execute on function public.request_marketing_web_push_dispatch() to service_role;

create or replace function public.queue_marketing_web_push_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.marketing_web_push_deliveries (
    notification_id,
    subscription_id,
    status,
    next_attempt_at
  )
  select
    new.id,
    subscription.id,
    'pending',
    now()
  from public.marketing_web_push_subscriptions subscription
  where subscription.member_id = new.recipient_member_id
    and subscription.is_active
  on conflict (notification_id, subscription_id) do nothing;

  perform public.request_marketing_web_push_dispatch();
  return new;
end;
$$;

revoke all on function public.queue_marketing_web_push_deliveries() from public, anon, authenticated;
grant execute on function public.queue_marketing_web_push_deliveries() to service_role;

drop trigger if exists marketing_notification_web_push_queue on public.marketing_notifications;
create trigger marketing_notification_web_push_queue
after insert on public.marketing_notifications
for each row execute function public.queue_marketing_web_push_deliveries();

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
    and task.start_date between hk_today - 1 and hk_today
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

revoke all on function public.queue_work_task_reminders() from public, anon, authenticated;
grant execute on function public.queue_work_task_reminders() to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'dispatch-marketing-web-push'
  limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'dispatch-marketing-web-push',
    '* * * * *',
    'select public.request_marketing_web_push_dispatch();'
  );

  select jobid into existing_job
  from cron.job
  where jobname = 'queue-work-task-reminders'
  limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'queue-work-task-reminders',
    '*/15 * * * *',
    'select public.queue_work_task_reminders();'
  );
end;
$$;
