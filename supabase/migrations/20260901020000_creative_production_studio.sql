-- Alyssa Creative Production Studio
-- Adds marketer-to-designer work allocation, rich briefs, assets, taxonomy,
-- calendar synchronization, audit history and Web Push reminders.

create table if not exists public.creative_taxonomy_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('source', 'usage', 'media_format')),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by_member_id uuid references public.workspace_members(id) on delete set null,
  updated_by_member_id uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creative_taxonomy_category_name_uq
  on public.creative_taxonomy_items(category, lower(btrim(name)));
create index if not exists creative_taxonomy_active_sort_idx
  on public.creative_taxonomy_items(category, is_active, sort_order, name);

create table if not exists public.creative_designer_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  linked_member_id uuid unique references public.workspace_members(id) on delete set null,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by_member_id uuid references public.workspace_members(id) on delete set null,
  updated_by_member_id uuid references public.workspace_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creative_designer_display_name_uq
  on public.creative_designer_profiles(lower(btrim(display_name)));
create index if not exists creative_designer_active_sort_idx
  on public.creative_designer_profiles(is_active, sort_order, display_name);

create table if not exists public.creative_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  treatment_id uuid references public.treatments(id) on delete set null,
  treatment_label text,
  title text not null default '未命名設計工作'
    check (char_length(btrim(title)) between 1 and 240),
  status text not null default 'draft'
    check (status in (
      'draft', 'assigned', 'waiting_assets', 'in_progress', 'review',
      'revision', 'approved', 'delivered', 'completed', 'blocked', 'cancelled'
    )),
  priority text not null default 'normal'
    check (priority in ('normal', 'priority', 'urgent')),
  workload text not null default 'M'
    check (workload in ('S', 'M', 'L', 'XL')),
  start_date date not null default ((now() at time zone 'Asia/Hong_Kong')::date),
  start_time time,
  due_date date,
  due_time time,
  publish_date date,
  publish_time time,
  sync_calendar boolean not null default false,
  calendar_item_id uuid references public.marketing_calendar_items(id) on delete set null,
  source_taxonomy_id uuid references public.creative_taxonomy_items(id) on delete set null,
  usage_taxonomy_id uuid references public.creative_taxonomy_items(id) on delete set null,
  media_format_taxonomy_id uuid references public.creative_taxonomy_items(id) on delete set null,
  assignee_profile_id uuid references public.creative_designer_profiles(id) on delete set null,
  assignee_member_id uuid references public.workspace_members(id) on delete set null,
  requester_member_id uuid references public.workspace_members(id) on delete set null,
  requester_email text,
  material_status text not null default 'ready'
    check (material_status in ('ready', 'waiting')),
  quantity integer not null default 1 check (quantity between 1 and 999),
  specifications text check (specifications is null or char_length(specifications) <= 4000),
  source_url text check (source_url is null or char_length(source_url) <= 2048),
  reference_url text check (reference_url is null or char_length(reference_url) <= 2048),
  brief_document jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  brief_plain_text text not null default '',
  revision_count integer not null default 0 check (revision_count >= 0),
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creative_jobs_start_due_check
    check (due_date is null or due_date >= start_date),
  constraint creative_jobs_due_publish_check
    check (publish_date is null or due_date is null or publish_date >= due_date),
  constraint creative_jobs_calendar_publish_check
    check (not sync_calendar or publish_date is not null),
  constraint creative_jobs_treatment_label_check
    check (treatment_label is null or char_length(btrim(treatment_label)) between 1 and 180)
);

create index if not exists creative_jobs_brand_start_idx
  on public.creative_jobs(brand_id, start_date desc, status)
  where deleted_at is null;
create index if not exists creative_jobs_assignee_start_idx
  on public.creative_jobs(assignee_member_id, start_date desc, status)
  where deleted_at is null;
create index if not exists creative_jobs_due_idx
  on public.creative_jobs(due_date, status)
  where deleted_at is null and due_date is not null;
create index if not exists creative_jobs_publish_idx
  on public.creative_jobs(publish_date, status)
  where deleted_at is null and sync_calendar;

create table if not exists public.creative_job_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.creative_jobs(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('upload', 'link')),
  purpose text not null default 'source'
    check (purpose in ('source', 'reference', 'draft', 'final', 'brief')),
  label text not null check (char_length(btrim(label)) between 1 and 240),
  external_url text,
  storage_path text,
  mime_type text,
  file_size bigint check (file_size is null or file_size between 0 and 26214400),
  inserted_in_brief boolean not null default false,
  created_by_member_id uuid references public.workspace_members(id) on delete set null,
  created_by_email text,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creative_job_assets_location_check
    check (
      (asset_kind = 'upload' and storage_path is not null and external_url is null)
      or (asset_kind = 'link' and external_url is not null and storage_path is null)
    ),
  constraint creative_job_assets_url_length_check
    check (external_url is null or char_length(external_url) <= 2048),
  constraint creative_job_assets_storage_path_length_check
    check (storage_path is null or char_length(storage_path) <= 500)
);

create index if not exists creative_job_assets_job_idx
  on public.creative_job_assets(job_id, removed_at, created_at desc);

create table if not exists public.creative_job_comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.creative_jobs(id) on delete cascade,
  author_member_id uuid references public.workspace_members(id) on delete set null,
  author_email text,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists creative_job_comments_job_idx
  on public.creative_job_comments(job_id, created_at desc)
  where deleted_at is null;

create table if not exists public.creative_job_brief_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.creative_jobs(id) on delete cascade,
  version_no integer not null check (version_no >= 1),
  document jsonb not null,
  plain_text text not null default '',
  reason text not null default 'autosave'
    check (reason in ('autosave', 'manual', 'status_change', 'restore')),
  created_by_member_id uuid references public.workspace_members(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  unique(job_id, version_no)
);

create index if not exists creative_job_brief_versions_job_idx
  on public.creative_job_brief_versions(job_id, version_no desc);

create table if not exists public.creative_job_audit (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.creative_jobs(id) on delete cascade,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  actor_email text,
  action text not null check (char_length(btrim(action)) between 1 and 160),
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists creative_job_audit_job_idx
  on public.creative_job_audit(job_id, created_at desc);

alter table public.creative_taxonomy_items enable row level security;
alter table public.creative_designer_profiles enable row level security;
alter table public.creative_jobs enable row level security;
alter table public.creative_job_assets enable row level security;
alter table public.creative_job_comments enable row level security;
alter table public.creative_job_brief_versions enable row level security;
alter table public.creative_job_audit enable row level security;

revoke all on table public.creative_taxonomy_items from anon, authenticated;
revoke all on table public.creative_designer_profiles from anon, authenticated;
revoke all on table public.creative_jobs from anon, authenticated;
revoke all on table public.creative_job_assets from anon, authenticated;
revoke all on table public.creative_job_comments from anon, authenticated;
revoke all on table public.creative_job_brief_versions from anon, authenticated;
revoke all on table public.creative_job_audit from anon, authenticated;

grant select, insert, update, delete on table public.creative_taxonomy_items to service_role;
grant select, insert, update, delete on table public.creative_designer_profiles to service_role;
grant select, insert, update, delete on table public.creative_jobs to service_role;
grant select, insert, update, delete on table public.creative_job_assets to service_role;
grant select, insert, update, delete on table public.creative_job_comments to service_role;
grant select, insert, update, delete on table public.creative_job_brief_versions to service_role;
grant select, insert, update, delete on table public.creative_job_audit to service_role;

alter table public.marketing_notifications
  add column if not exists creative_job_id uuid references public.creative_jobs(id) on delete cascade,
  add column if not exists action_url text;

alter table public.marketing_notifications
  drop constraint if exists marketing_notifications_action_url_check;
alter table public.marketing_notifications
  add constraint marketing_notifications_action_url_check
  check (
    action_url is null
    or (char_length(action_url) between 1 and 500 and left(action_url, 1) = '/')
  );

create index if not exists marketing_notifications_creative_job_idx
  on public.marketing_notifications(creative_job_id, recipient_member_id, is_read, created_at desc)
  where creative_job_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creative-job-assets',
  'creative-job-assets',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into public.creative_designer_profiles (display_name, sort_order)
values ('Amber', 10), ('Vicky', 20)
on conflict do nothing;

insert into public.creative_taxonomy_items (category, name, sort_order)
values
  ('source', 'KOL 拍攝 Raw Footage', 10),
  ('source', '公司拍攝素材', 20),
  ('source', '現有舊素材重製', 30),
  ('source', '客人評論／Screenshot', 40),
  ('source', '療程／價目資料', 50),
  ('source', '網站現有內容', 60),
  ('source', 'AI 生成素材', 70),
  ('source', '暫未有素材', 80),
  ('usage', 'Feed', 10),
  ('usage', 'Story', 20),
  ('usage', 'Meta AD', 30),
  ('usage', 'Google AD', 40),
  ('usage', 'Reel／短片', 50),
  ('usage', 'Website', 60),
  ('usage', 'Price List', 70),
  ('usage', 'WhatsApp／Messenger', 80),
  ('usage', '分店路線圖', 90),
  ('usage', 'Presentation／內部文件', 100),
  ('media_format', '靜態圖', 10),
  ('media_format', 'Carousel', 20),
  ('media_format', 'Video', 30),
  ('media_format', 'Motion Graphic', 40),
  ('media_format', 'PDF／文件', 50),
  ('media_format', 'Website Desktop Image', 60),
  ('media_format', 'Website Mobile Image', 70)
on conflict do nothing;

-- Existing members with explicit module lists need the new module written into
-- their permission rows. Marketers, managers, admins and designers receive it;
-- CS and viewers remain excluded by default.
insert into public.workspace_member_module_permissions (
  member_id, module_key, can_access, created_at, updated_at
)
select
  member.id,
  'creative_jobs',
  true,
  now(),
  now()
from public.workspace_members member
where member.workspace_role in ('owner', 'admin', 'manager', 'marketer', 'designer')
on conflict (member_id, module_key) do update
set can_access = excluded.can_access,
    updated_at = excluded.updated_at;

delete from public.workspace_member_module_permissions permission
using public.workspace_members member
where permission.member_id = member.id
  and permission.module_key = 'creative_jobs'
  and member.workspace_role in ('cs', 'viewer');

-- Extend member-management wrappers without changing the lower-level member
-- functions. The new module is removed before delegating, then stored alongside
-- the special Lead Audit permission.
create or replace function public.create_workspace_member_invitation_with_audit_access(
  p_email text,
  p_full_name text,
  p_workspace_role text,
  p_brand_ids uuid[],
  p_module_keys text[],
  p_invited_by_member_id uuid,
  p_invited_by_email text
)
returns uuid
language plpgsql
set search_path to ''
as $$
declare
  v_member_id uuid;
  v_base_modules text[];
begin
  if exists (
    select 1 from unnest(coalesce(p_module_keys, array[]::text[])) requested(module_key)
    where requested.module_key not in (
      'dashboard', 'kpis', 'calendar', 'creative_jobs', 'launchhub', 'leads', 'crm',
      'performance', 'data_sources', 'settings', 'system_audit', 'lead_audit'
    )
  ) then
    raise exception using errcode = '22023', message = 'invalid_member_module';
  end if;

  v_base_modules := array_remove(
    array_remove(coalesce(p_module_keys, array[]::text[]), 'lead_audit'),
    'creative_jobs'
  );

  v_member_id := public.create_workspace_member_invitation(
    p_email,
    p_full_name,
    p_workspace_role,
    p_brand_ids,
    v_base_modules,
    p_invited_by_member_id,
    p_invited_by_email
  );

  if 'lead_audit' = any(coalesce(p_module_keys, array[]::text[])) then
    insert into public.workspace_member_module_permissions (
      member_id, module_key, can_access, created_at, updated_at
    ) values (v_member_id, 'lead_audit', true, now(), now())
    on conflict (member_id, module_key) do update
      set can_access = true, updated_at = excluded.updated_at;
  end if;

  if 'creative_jobs' = any(coalesce(p_module_keys, array[]::text[])) then
    insert into public.workspace_member_module_permissions (
      member_id, module_key, can_access, created_at, updated_at
    ) values (v_member_id, 'creative_jobs', true, now(), now())
    on conflict (member_id, module_key) do update
      set can_access = true, updated_at = excluded.updated_at;
  end if;

  return v_member_id;
end;
$$;

create or replace function public.update_workspace_member_access_with_audit_access(
  p_member_id uuid,
  p_full_name text,
  p_workspace_role text,
  p_brand_ids uuid[],
  p_module_keys text[]
)
returns void
language plpgsql
set search_path to ''
as $$
declare
  v_base_modules text[];
begin
  if exists (
    select 1 from unnest(coalesce(p_module_keys, array[]::text[])) requested(module_key)
    where requested.module_key not in (
      'dashboard', 'kpis', 'calendar', 'creative_jobs', 'launchhub', 'leads', 'crm',
      'performance', 'data_sources', 'settings', 'system_audit', 'lead_audit'
    )
  ) then
    raise exception using errcode = '22023', message = 'invalid_member_module';
  end if;

  v_base_modules := array_remove(
    array_remove(coalesce(p_module_keys, array[]::text[]), 'lead_audit'),
    'creative_jobs'
  );

  perform public.update_workspace_member_access(
    p_member_id,
    p_full_name,
    p_workspace_role,
    p_brand_ids,
    v_base_modules
  );

  if 'lead_audit' = any(coalesce(p_module_keys, array[]::text[])) then
    insert into public.workspace_member_module_permissions (
      member_id, module_key, can_access, created_at, updated_at
    ) values (p_member_id, 'lead_audit', true, now(), now())
    on conflict (member_id, module_key) do update
      set can_access = true, updated_at = excluded.updated_at;
  end if;

  if 'creative_jobs' = any(coalesce(p_module_keys, array[]::text[])) then
    insert into public.workspace_member_module_permissions (
      member_id, module_key, can_access, created_at, updated_at
    ) values (p_member_id, 'creative_jobs', true, now(), now())
    on conflict (member_id, module_key) do update
      set can_access = true, updated_at = excluded.updated_at;
  end if;
end;
$$;

-- Save metadata and Calendar linkage in one database transaction.
create or replace function public.save_creative_job_with_calendar(
  p_job_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_job public.creative_jobs%rowtype;
  existing_calendar public.marketing_calendar_items%rowtype;
  next_calendar_id uuid;
  should_sync boolean := coalesce((p_payload ->> 'syncCalendar')::boolean, false);
  next_publish_date date := nullif(p_payload ->> 'publishDate', '')::date;
  next_publish_time time := nullif(p_payload ->> 'publishTime', '')::time;
  next_title text := btrim(coalesce(p_payload ->> 'title', ''));
begin
  select * into existing_job
  from public.creative_jobs
  where id = p_job_id and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'creative_job_not_found';
  end if;

  if next_title = '' then
    raise exception using errcode = '22023', message = 'creative_job_title_required';
  end if;

  next_calendar_id := existing_job.calendar_item_id;

  if should_sync then
    if next_publish_date is null then
      raise exception using errcode = '22023', message = 'creative_publish_date_required';
    end if;

    if next_calendar_id is not null then
      select * into existing_calendar
      from public.marketing_calendar_items
      where id = next_calendar_id
      for update;

      if found and existing_calendar.published_at is not null and (
        existing_calendar.scheduled_date is distinct from next_publish_date
        or existing_calendar.scheduled_time is distinct from next_publish_time
      ) then
        raise exception using errcode = '55000', message = 'creative_calendar_already_published';
      end if;
    end if;

    if next_calendar_id is null or not found then
      insert into public.marketing_calendar_items (
        brand_id,
        treatment_id,
        treatment_label,
        title,
        item_type,
        channel,
        status,
        scheduled_date,
        scheduled_time,
        assignee_email,
        notes,
        show_on_performance_timeline
      ) values (
        (p_payload ->> 'brandId')::uuid,
        nullif(p_payload ->> 'treatmentId', '')::uuid,
        nullif(p_payload ->> 'treatmentLabel', ''),
        next_title,
        coalesce(nullif(p_payload ->> 'calendarItemType', ''), 'post'),
        nullif(p_payload ->> 'calendarChannel', ''),
        'scheduled',
        next_publish_date,
        next_publish_time,
        nullif(p_payload ->> 'assigneeEmail', ''),
        'Creative Job · ' || p_job_id::text,
        coalesce((p_payload ->> 'showOnPerformanceTimeline')::boolean, true)
      ) returning id into next_calendar_id;
    else
      update public.marketing_calendar_items
      set
        brand_id = (p_payload ->> 'brandId')::uuid,
        treatment_id = nullif(p_payload ->> 'treatmentId', '')::uuid,
        treatment_label = nullif(p_payload ->> 'treatmentLabel', ''),
        title = next_title,
        item_type = coalesce(nullif(p_payload ->> 'calendarItemType', ''), 'post'),
        channel = nullif(p_payload ->> 'calendarChannel', ''),
        scheduled_date = next_publish_date,
        scheduled_time = next_publish_time,
        assignee_email = nullif(p_payload ->> 'assigneeEmail', ''),
        notes = 'Creative Job · ' || p_job_id::text,
        show_on_performance_timeline = coalesce(
          (p_payload ->> 'showOnPerformanceTimeline')::boolean,
          true
        ),
        updated_at = now()
      where id = next_calendar_id;
    end if;
  elsif next_calendar_id is not null then
    select * into existing_calendar
    from public.marketing_calendar_items
    where id = next_calendar_id
    for update;

    if found and existing_calendar.published_at is null then
      delete from public.marketing_calendar_items where id = next_calendar_id;
      next_calendar_id := null;
    end if;
  end if;

  update public.creative_jobs
  set
    brand_id = (p_payload ->> 'brandId')::uuid,
    treatment_id = nullif(p_payload ->> 'treatmentId', '')::uuid,
    treatment_label = nullif(p_payload ->> 'treatmentLabel', ''),
    title = next_title,
    status = p_payload ->> 'status',
    priority = p_payload ->> 'priority',
    workload = p_payload ->> 'workload',
    start_date = (p_payload ->> 'startDate')::date,
    start_time = nullif(p_payload ->> 'startTime', '')::time,
    due_date = nullif(p_payload ->> 'dueDate', '')::date,
    due_time = nullif(p_payload ->> 'dueTime', '')::time,
    publish_date = case when should_sync then next_publish_date else null end,
    publish_time = case when should_sync then next_publish_time else null end,
    sync_calendar = should_sync,
    calendar_item_id = next_calendar_id,
    source_taxonomy_id = nullif(p_payload ->> 'sourceTaxonomyId', '')::uuid,
    usage_taxonomy_id = nullif(p_payload ->> 'usageTaxonomyId', '')::uuid,
    media_format_taxonomy_id = nullif(p_payload ->> 'mediaFormatTaxonomyId', '')::uuid,
    assignee_profile_id = nullif(p_payload ->> 'assigneeProfileId', '')::uuid,
    assignee_member_id = nullif(p_payload ->> 'assigneeMemberId', '')::uuid,
    material_status = p_payload ->> 'materialStatus',
    quantity = (p_payload ->> 'quantity')::integer,
    specifications = nullif(p_payload ->> 'specifications', ''),
    source_url = nullif(p_payload ->> 'sourceUrl', ''),
    reference_url = nullif(p_payload ->> 'referenceUrl', ''),
    completed_at = case
      when p_payload ->> 'status' = 'completed' then coalesce(completed_at, now())
      else null
    end,
    revision_count = case
      when existing_job.status is distinct from 'revision'
        and p_payload ->> 'status' = 'revision'
      then revision_count + 1
      else revision_count
    end,
    updated_at = now()
  where id = p_job_id;

  return jsonb_build_object('calendarItemId', next_calendar_id);
end;
$$;

revoke all on function public.save_creative_job_with_calendar(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_creative_job_with_calendar(uuid, jsonb)
  to service_role;

create or replace function public.queue_creative_job_reminders()
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
    creative_job_id,
    notification_type,
    title,
    body,
    action_url,
    dedupe_key
  )
  select
    job.assignee_member_id,
    member.email,
    job.brand_id,
    job.id,
    'creative_starting',
    '今日開始設計工作',
    job.title,
    '/creative-jobs/' || job.id::text,
    'creative_starting:' || job.id::text || ':' || job.start_date::text
  from public.creative_jobs job
  join public.workspace_members member on member.id = job.assignee_member_id
  where job.deleted_at is null
    and job.status not in ('completed', 'cancelled')
    and job.assignee_member_id is not null
    and job.start_date between hk_today - 1 and hk_today
    and (
      (job.start_date + coalesce(job.start_time, time '09:00'))
      at time zone 'Asia/Hong_Kong'
    ) <= now()
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  queued_count := queued_count + inserted_count;

  insert into public.marketing_notifications (
    recipient_member_id,
    recipient_email,
    brand_id,
    creative_job_id,
    notification_type,
    title,
    body,
    action_url,
    dedupe_key
  )
  select
    job.assignee_member_id,
    member.email,
    job.brand_id,
    job.id,
    'creative_due_soon',
    '設計工作將於 24 小時內到期',
    job.title,
    '/creative-jobs/' || job.id::text,
    'creative_due_soon:' || job.id::text || ':' || job.due_date::text || ':' || coalesce(job.due_time::text, '12:00')
  from public.creative_jobs job
  join public.workspace_members member on member.id = job.assignee_member_id
  where job.deleted_at is null
    and job.status not in ('completed', 'cancelled')
    and job.due_date is not null
    and (
      (job.due_date + coalesce(job.due_time, time '12:00'))
      at time zone 'Asia/Hong_Kong'
    ) > now()
    and (
      (job.due_date + coalesce(job.due_time, time '12:00'))
      at time zone 'Asia/Hong_Kong'
    ) <= now() + interval '24 hours'
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  queued_count := queued_count + inserted_count;

  insert into public.marketing_notifications (
    recipient_member_id,
    recipient_email,
    brand_id,
    creative_job_id,
    notification_type,
    title,
    body,
    action_url,
    dedupe_key
  )
  select
    job.assignee_member_id,
    member.email,
    job.brand_id,
    job.id,
    'creative_overdue',
    '設計工作已逾期',
    job.title,
    '/creative-jobs/' || job.id::text,
    'creative_overdue:' || job.id::text || ':' || job.due_date::text || ':' || coalesce(job.due_time::text, '12:00')
  from public.creative_jobs job
  join public.workspace_members member on member.id = job.assignee_member_id
  where job.deleted_at is null
    and job.status not in ('completed', 'cancelled')
    and job.due_date is not null
    and job.due_date >= hk_today - 14
    and (
      (job.due_date + coalesce(job.due_time, time '12:00'))
      at time zone 'Asia/Hong_Kong'
    ) <= now()
  on conflict (dedupe_key) do nothing;
  get diagnostics inserted_count = row_count;
  queued_count := queued_count + inserted_count;

  return queued_count;
end;
$$;

revoke all on function public.queue_creative_job_reminders()
  from public, anon, authenticated;
grant execute on function public.queue_creative_job_reminders()
  to service_role;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'queue-creative-job-reminders'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'queue-creative-job-reminders',
    '*/15 * * * *',
    'select public.queue_creative_job_reminders();'
  );
end;
$$;
