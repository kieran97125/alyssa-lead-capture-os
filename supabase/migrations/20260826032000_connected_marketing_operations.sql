-- Connected Marketing Operations v1
-- Calendar automation, weekly work, in-app notifications and performance events.

create extension if not exists pg_cron;

-- 1) Marketing Calendar: reduce the public workflow to Idea / Scheduled / Published.
update public.marketing_calendar_items
set status = 'idea', updated_at = now()
where status not in ('idea', 'scheduled', 'published');

alter table public.marketing_calendar_items
  add column if not exists published_at timestamptz,
  add column if not exists auto_published_at timestamptz,
  add column if not exists show_on_performance_timeline boolean not null default true;

update public.marketing_calendar_items
set published_at = coalesce(published_at, updated_at, now())
where status = 'published' and published_at is null;

alter table public.marketing_calendar_items
  alter column status set default 'idea';

alter table public.marketing_calendar_items
  drop constraint if exists marketing_calendar_items_status_check;

alter table public.marketing_calendar_items
  add constraint marketing_calendar_items_status_check
  check (status = any (array['idea'::text, 'scheduled'::text, 'published'::text]));

-- 2) Weekly work items. Brand is mandatory so existing brand access remains the security boundary.
create table if not exists public.marketing_work_tasks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete set null,
  treatment_label text,
  title text not null,
  description text,
  status text not null default 'todo'
    check (status = any (array['todo'::text, 'in_progress'::text, 'done'::text])),
  priority text not null default 'normal'
    check (priority = any (array['low'::text, 'normal'::text, 'high'::text])),
  assignee_member_id uuid references public.workspace_members(id) on delete set null,
  assignee_email text,
  created_by_member_id uuid references public.workspace_members(id) on delete set null,
  created_by_email text,
  due_date date,
  due_time time,
  performance_marker boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_work_tasks_title_check check (
    char_length(trim(title)) between 1 and 180
  ),
  constraint marketing_work_tasks_description_check check (
    description is null or char_length(description) <= 4000
  ),
  constraint marketing_work_tasks_treatment_label_check check (
    treatment_label is null or char_length(trim(treatment_label)) between 1 and 180
  )
);

create index if not exists marketing_work_tasks_brand_due_idx
  on public.marketing_work_tasks(brand_id, due_date, status);
create index if not exists marketing_work_tasks_assignee_due_idx
  on public.marketing_work_tasks(assignee_member_id, status, due_date);

alter table public.marketing_work_tasks enable row level security;

create table if not exists public.marketing_task_calendar_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.marketing_work_tasks(id) on delete cascade,
  calendar_item_id uuid not null references public.marketing_calendar_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(task_id, calendar_item_id)
);
create index if not exists marketing_task_calendar_links_calendar_idx
  on public.marketing_task_calendar_links(calendar_item_id, task_id);
alter table public.marketing_task_calendar_links enable row level security;

create table if not exists public.marketing_task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.marketing_work_tasks(id) on delete cascade,
  author_member_id uuid references public.workspace_members(id) on delete set null,
  author_email text,
  body text not null,
  created_at timestamptz not null default now(),
  constraint marketing_task_comments_body_check check (
    char_length(trim(body)) between 1 and 2000
  )
);
create index if not exists marketing_task_comments_task_created_idx
  on public.marketing_task_comments(task_id, created_at desc);
alter table public.marketing_task_comments enable row level security;

create table if not exists public.marketing_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_member_id uuid not null references public.workspace_members(id) on delete cascade,
  recipient_email text,
  brand_id uuid references public.brands(id) on delete cascade,
  task_id uuid references public.marketing_work_tasks(id) on delete cascade,
  calendar_item_id uuid references public.marketing_calendar_items(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  dedupe_key text unique,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketing_notifications_title_check check (
    char_length(trim(title)) between 1 and 240
  )
);
create index if not exists marketing_notifications_recipient_unread_idx
  on public.marketing_notifications(recipient_member_id, is_read, created_at desc);
alter table public.marketing_notifications enable row level security;

-- 3) Central event layer used by Dashboard / Treatment Performance timeline markers.
create table if not exists public.marketing_operational_events (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  treatment_id uuid references public.treatments(id) on delete set null,
  treatment_label text,
  event_date date not null,
  event_at timestamptz,
  event_type text not null,
  title text not null,
  item_type text not null default 'task',
  channel text,
  notes text,
  source_entity_type text not null,
  source_entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_entity_type, source_entity_id, event_type)
);
create index if not exists marketing_operational_events_brand_date_idx
  on public.marketing_operational_events(brand_id, event_date, event_type);
alter table public.marketing_operational_events enable row level security;

-- Keep linked Weekly Tasks aligned with Calendar scheduling. Publishing a linked
-- Calendar item completes the execution task; completing a generic task does NOT
-- publish the Calendar item, so content completion is never mistaken for go-live.
create or replace function public.sync_calendar_operational_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.marketing_operational_events
    where source_entity_type = 'calendar_item'
      and source_entity_id = old.id
      and event_type = 'calendar_published';
    return old;
  end if;

  update public.marketing_work_tasks task
  set
    due_date = new.scheduled_date,
    due_time = new.scheduled_time,
    status = case
      when new.status = 'published' then 'done'
      else task.status
    end,
    completed_at = case
      when new.status = 'published' then coalesce(task.completed_at, new.published_at, now())
      else task.completed_at
    end,
    updated_at = now()
  where task.id in (
    select link.task_id
    from public.marketing_task_calendar_links link
    where link.calendar_item_id = new.id
  )
    and (
      task.due_date is distinct from new.scheduled_date
      or task.due_time is distinct from new.scheduled_time
      or (new.status = 'published' and task.status <> 'done')
    );

  if new.status = 'published' and new.show_on_performance_timeline then
    insert into public.marketing_operational_events (
      brand_id,
      treatment_id,
      treatment_label,
      event_date,
      event_at,
      event_type,
      title,
      item_type,
      channel,
      notes,
      source_entity_type,
      source_entity_id,
      metadata,
      updated_at
    ) values (
      new.brand_id,
      new.treatment_id,
      new.treatment_label,
      new.scheduled_date,
      coalesce(
        new.published_at,
        ((new.scheduled_date + coalesce(new.scheduled_time, time '12:00')) at time zone 'Asia/Hong_Kong')
      ),
      'calendar_published',
      new.title,
      new.item_type,
      new.channel,
      new.notes,
      'calendar_item',
      new.id,
      jsonb_build_object('autoPublished', new.auto_published_at is not null),
      now()
    )
    on conflict (source_entity_type, source_entity_id, event_type)
    do update set
      brand_id = excluded.brand_id,
      treatment_id = excluded.treatment_id,
      treatment_label = excluded.treatment_label,
      event_date = excluded.event_date,
      event_at = excluded.event_at,
      title = excluded.title,
      item_type = excluded.item_type,
      channel = excluded.channel,
      notes = excluded.notes,
      metadata = excluded.metadata,
      updated_at = now();
  else
    delete from public.marketing_operational_events
    where source_entity_type = 'calendar_item'
      and source_entity_id = new.id
      and event_type = 'calendar_published';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_calendar_operational_event() from public, anon, authenticated;
grant execute on function public.sync_calendar_operational_event() to service_role;

drop trigger if exists marketing_calendar_operational_event_sync on public.marketing_calendar_items;
create trigger marketing_calendar_operational_event_sync
after insert or update or delete on public.marketing_calendar_items
for each row execute function public.sync_calendar_operational_event();

-- Important completed work can appear on the same performance timeline.
create or replace function public.sync_task_operational_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.marketing_operational_events
    where source_entity_type = 'work_task'
      and source_entity_id = old.id
      and event_type = 'task_milestone';
    return old;
  end if;

  if new.status = 'done' and new.performance_marker then
    insert into public.marketing_operational_events (
      brand_id,
      treatment_id,
      treatment_label,
      event_date,
      event_at,
      event_type,
      title,
      item_type,
      notes,
      source_entity_type,
      source_entity_id,
      metadata,
      updated_at
    ) values (
      new.brand_id,
      new.treatment_id,
      new.treatment_label,
      coalesce(new.due_date, (coalesce(new.completed_at, now()) at time zone 'Asia/Hong_Kong')::date),
      coalesce(new.completed_at, now()),
      'task_milestone',
      new.title,
      'task',
      new.description,
      'work_task',
      new.id,
      jsonb_build_object('priority', new.priority),
      now()
    )
    on conflict (source_entity_type, source_entity_id, event_type)
    do update set
      brand_id = excluded.brand_id,
      treatment_id = excluded.treatment_id,
      treatment_label = excluded.treatment_label,
      event_date = excluded.event_date,
      event_at = excluded.event_at,
      title = excluded.title,
      notes = excluded.notes,
      metadata = excluded.metadata,
      updated_at = now();
  else
    delete from public.marketing_operational_events
    where source_entity_type = 'work_task'
      and source_entity_id = new.id
      and event_type = 'task_milestone';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_task_operational_event() from public, anon, authenticated;
grant execute on function public.sync_task_operational_event() to service_role;

drop trigger if exists marketing_task_operational_event_sync on public.marketing_work_tasks;
create trigger marketing_task_operational_event_sync
after insert or update or delete on public.marketing_work_tasks
for each row execute function public.sync_task_operational_event();

-- Backfill central events for any Calendar items already published before this layer existed.
insert into public.marketing_operational_events (
  brand_id,
  treatment_id,
  treatment_label,
  event_date,
  event_at,
  event_type,
  title,
  item_type,
  channel,
  notes,
  source_entity_type,
  source_entity_id,
  metadata,
  updated_at
)
select
  item.brand_id,
  item.treatment_id,
  item.treatment_label,
  item.scheduled_date,
  coalesce(
    item.published_at,
    ((item.scheduled_date + coalesce(item.scheduled_time, time '12:00')) at time zone 'Asia/Hong_Kong')
  ),
  'calendar_published',
  item.title,
  item.item_type,
  item.channel,
  item.notes,
  'calendar_item',
  item.id,
  jsonb_build_object('autoPublished', item.auto_published_at is not null),
  now()
from public.marketing_calendar_items item
where item.status = 'published'
  and item.show_on_performance_timeline
on conflict (source_entity_type, source_entity_id, event_type)
do update set
  event_date = excluded.event_date,
  event_at = excluded.event_at,
  title = excluded.title,
  item_type = excluded.item_type,
  channel = excluded.channel,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

-- 4) Auto publish Scheduled calendar items at their HKT date/time.
-- Missing time intentionally means 12:00 HKT.
create or replace function public.publish_due_marketing_calendar_items()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer := 0;
begin
  with due as (
    update public.marketing_calendar_items
    set
      status = 'published',
      published_at = coalesce(published_at, now()),
      auto_published_at = coalesce(auto_published_at, now()),
      updated_at = now()
    where status = 'scheduled'
      and ((scheduled_date + coalesce(scheduled_time, time '12:00')) at time zone 'Asia/Hong_Kong') <= now()
    returning id, brand_id, title, assignee_email
  ), notified as (
    insert into public.marketing_notifications (
      recipient_member_id,
      recipient_email,
      brand_id,
      calendar_item_id,
      notification_type,
      title,
      body,
      dedupe_key
    )
    select
      wm.id,
      wm.email,
      due.brand_id,
      due.id,
      'calendar_published',
      '已自動更新為 Published',
      due.title,
      'calendar_published:' || due.id::text
    from due
    join public.workspace_members wm
      on lower(wm.email) = lower(coalesce(due.assignee_email, ''))
     and wm.status = 'active'
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*)::integer into updated_count from due;

  return updated_count;
end;
$$;

revoke all on function public.publish_due_marketing_calendar_items() from public, anon, authenticated;
grant execute on function public.publish_due_marketing_calendar_items() to service_role;

-- Reconcile any already-due rows immediately, then every minute.
select public.publish_due_marketing_calendar_items();

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'publish-due-marketing-calendar-items'
  limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'publish-due-marketing-calendar-items',
    '* * * * *',
    'select public.publish_due_marketing_calendar_items();'
  );
end;
$$;

-- No browser role writes directly to these operational tables. The app server
-- enforces module + brand access before using the service role.
revoke all on table public.marketing_work_tasks from anon, authenticated;
revoke all on table public.marketing_task_calendar_links from anon, authenticated;
revoke all on table public.marketing_task_comments from anon, authenticated;
revoke all on table public.marketing_notifications from anon, authenticated;
revoke all on table public.marketing_operational_events from anon, authenticated;

grant select, insert, update, delete on table public.marketing_work_tasks to service_role;
grant select, insert, update, delete on table public.marketing_task_calendar_links to service_role;
grant select, insert, update, delete on table public.marketing_task_comments to service_role;
grant select, insert, update, delete on table public.marketing_notifications to service_role;
grant select, insert, update, delete on table public.marketing_operational_events to service_role;
