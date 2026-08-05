-- Immutable, encrypted Lead Sheet snapshot lineage and anomaly review.
-- Customer-level payloads are encrypted by the application before they reach
-- Postgres. Browser roles never receive table grants; authorized pages read
-- through the server-only service client and re-apply workspace permissions.

create table public.lead_sheet_audit_runs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null
    references public.marketing_data_sources(id) on delete restrict,
  previous_run_id uuid null
    references public.lead_sheet_audit_runs(id) on delete set null,
  status text not null,
  policy_version text not null,
  snapshot_date date not null,
  row_count integer not null default 0 check (row_count >= 0),
  added_count integer not null default 0 check (added_count >= 0),
  modified_count integer not null default 0 check (modified_count >= 0),
  deleted_count integer not null default 0 check (deleted_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  critical_count integer not null default 0 check (critical_count >= 0),
  sheet_checksum text null,
  headers_checksum text null,
  actor_identifier text null,
  summary_json jsonb not null default '{}'::jsonb,
  error_summary text null,
  started_at timestamptz not null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint lead_sheet_audit_runs_status_check
    check (status in ('baseline', 'completed', 'quarantined', 'failed')),
  constraint lead_sheet_audit_runs_summary_check
    check (jsonb_typeof(summary_json) = 'object'),
  constraint lead_sheet_audit_runs_checksum_check
    check (
      (sheet_checksum is null or sheet_checksum ~ '^[0-9a-f]{64}$')
      and (headers_checksum is null or headers_checksum ~ '^[0-9a-f]{64}$')
    )
);

create index lead_sheet_audit_runs_source_completed_idx
  on public.lead_sheet_audit_runs(data_source_id, completed_at desc, id desc);
create index lead_sheet_audit_runs_open_status_idx
  on public.lead_sheet_audit_runs(status, completed_at desc)
  where status in ('quarantined', 'failed');

create table public.lead_sheet_audit_record_versions (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null
    references public.marketing_data_sources(id) on delete restrict,
  record_key text not null,
  content_hash text not null,
  key_version text not null,
  subject_label text not null,
  payload_ciphertext text not null,
  payload_iv text not null,
  payload_auth_tag text not null,
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (data_source_id, record_key, content_hash),
  constraint lead_sheet_audit_record_versions_key_check
    check (record_key ~ '^[0-9a-f]{64}(:[0-9]+)?$'),
  constraint lead_sheet_audit_record_versions_hash_check
    check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint lead_sheet_audit_record_versions_key_version_check
    check (key_version ~ '^[A-Za-z0-9._-]{1,40}$'),
  constraint lead_sheet_audit_record_versions_subject_check
    check (length(subject_label) between 1 and 120)
);

create index lead_sheet_audit_record_versions_lookup_idx
  on public.lead_sheet_audit_record_versions(data_source_id, record_key);

create table public.lead_sheet_audit_snapshot_entries (
  run_id uuid not null
    references public.lead_sheet_audit_runs(id) on delete cascade,
  record_version_id uuid not null
    references public.lead_sheet_audit_record_versions(id) on delete restrict,
  record_key text not null,
  row_number integer not null check (row_number >= 2),
  created_at timestamptz not null default now(),
  primary key (run_id, record_key),
  unique (run_id, row_number)
);

create index lead_sheet_audit_snapshot_entries_version_idx
  on public.lead_sheet_audit_snapshot_entries(record_version_id);

create table public.lead_sheet_audit_changes (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.lead_sheet_audit_runs(id) on delete cascade,
  brand_id uuid null references public.brands(id) on delete set null,
  record_key text null,
  subject_label text not null,
  change_type text not null,
  severity text not null,
  risk_code text not null,
  summary text not null,
  changed_fields text[] not null default '{}',
  before_version_id uuid null
    references public.lead_sheet_audit_record_versions(id) on delete restrict,
  after_version_id uuid null
    references public.lead_sheet_audit_record_versions(id) on delete restrict,
  review_status text not null,
  review_note text null,
  reviewed_by_member_id uuid null
    references public.workspace_members(id) on delete set null,
  reviewed_by_email text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint lead_sheet_audit_changes_severity_check
    check (severity in ('info', 'warning', 'critical')),
  constraint lead_sheet_audit_changes_review_status_check
    check (review_status in ('informational', 'open', 'reviewed', 'expected', 'dismissed')),
  constraint lead_sheet_audit_changes_subject_check
    check (length(subject_label) between 1 and 120),
  constraint lead_sheet_audit_changes_summary_check
    check (length(summary) between 1 and 500),
  constraint lead_sheet_audit_changes_review_note_check
    check (review_note is null or length(review_note) <= 1000)
);

create index lead_sheet_audit_changes_open_idx
  on public.lead_sheet_audit_changes(review_status, severity, created_at desc)
  where review_status = 'open';
create index lead_sheet_audit_changes_run_idx
  on public.lead_sheet_audit_changes(run_id, severity, created_at desc);
create index lead_sheet_audit_changes_brand_idx
  on public.lead_sheet_audit_changes(brand_id, created_at desc)
  where brand_id is not null;
create index lead_sheet_audit_changes_before_version_idx
  on public.lead_sheet_audit_changes(before_version_id)
  where before_version_id is not null;
create index lead_sheet_audit_changes_after_version_idx
  on public.lead_sheet_audit_changes(after_version_id)
  where after_version_id is not null;

alter table public.lead_sheet_audit_runs enable row level security;
alter table public.lead_sheet_audit_record_versions enable row level security;
alter table public.lead_sheet_audit_snapshot_entries enable row level security;
alter table public.lead_sheet_audit_changes enable row level security;

revoke all on table public.lead_sheet_audit_runs from public, anon, authenticated;
revoke all on table public.lead_sheet_audit_record_versions from public, anon, authenticated;
revoke all on table public.lead_sheet_audit_snapshot_entries from public, anon, authenticated;
revoke all on table public.lead_sheet_audit_changes from public, anon, authenticated;

grant select, insert, update, delete on table public.lead_sheet_audit_runs to service_role;
grant select, insert, update, delete on table public.lead_sheet_audit_record_versions to service_role;
grant select, insert, update, delete on table public.lead_sheet_audit_snapshot_entries to service_role;
grant select, insert, update, delete on table public.lead_sheet_audit_changes to service_role;

comment on table public.lead_sheet_audit_runs is
  'Server-only immutable sync snapshots. Quarantined runs remain evidence but never become the next accepted comparison baseline.';
comment on table public.lead_sheet_audit_record_versions is
  'Content-addressed encrypted Lead Sheet record versions. Payload plaintext must never be stored in Postgres or returned to browser clients.';
comment on table public.lead_sheet_audit_snapshot_entries is
  'Complete membership map that reconstructs one Lead Sheet snapshot while reusing unchanged encrypted record versions.';
comment on table public.lead_sheet_audit_changes is
  'Server-only row and batch anomaly evidence with an explicit human review lifecycle.';

create or replace function public.commit_lead_sheet_audit_snapshot(
  p_data_source_id uuid,
  p_previous_run_id uuid,
  p_status text,
  p_policy_version text,
  p_row_count integer,
  p_sheet_checksum text,
  p_headers_checksum text,
  p_actor_identifier text,
  p_summary jsonb,
  p_versions jsonb,
  p_entries jsonb,
  p_changes jsonb,
  p_started_at timestamptz,
  p_completed_at timestamptz
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_latest_run_id uuid;
  v_run_id uuid;
  v_inserted_entries integer := 0;
  v_added integer := 0;
  v_modified integer := 0;
  v_deleted integer := 0;
  v_warning integer := 0;
  v_critical integer := 0;
  v_open_alerts integer := 0;
begin
  if p_status not in ('baseline', 'completed', 'quarantined')
    or p_row_count < 0
    or jsonb_typeof(coalesce(p_summary, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_versions, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_changes, '[]'::jsonb)) <> 'array'
  then
    raise exception using errcode = '22023', message = 'invalid_lead_audit_snapshot';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_data_source_id::text || ':lead_sheet_audit', 0)
  );

  select audit_run.id
  into v_latest_run_id
  from public.lead_sheet_audit_runs as audit_run
  where audit_run.data_source_id = p_data_source_id
    and audit_run.status in ('baseline', 'completed')
  order by audit_run.completed_at desc nulls last, audit_run.id desc
  limit 1;

  if v_latest_run_id is distinct from p_previous_run_id then
    raise exception using errcode = '40001', message = 'stale_lead_audit_baseline';
  end if;
  if v_latest_run_id is null and p_status <> 'baseline' then
    raise exception using errcode = '22023', message = 'first_lead_audit_run_must_be_baseline';
  end if;
  if v_latest_run_id is not null and p_status = 'baseline' then
    raise exception using errcode = '22023', message = 'lead_audit_baseline_already_exists';
  end if;

  insert into public.lead_sheet_audit_runs (
    data_source_id,
    previous_run_id,
    status,
    policy_version,
    snapshot_date,
    row_count,
    sheet_checksum,
    headers_checksum,
    actor_identifier,
    summary_json,
    started_at,
    completed_at
  ) values (
    p_data_source_id,
    p_previous_run_id,
    p_status,
    p_policy_version,
    timezone('Asia/Hong_Kong', p_completed_at)::date,
    p_row_count,
    p_sheet_checksum,
    p_headers_checksum,
    nullif(btrim(coalesce(p_actor_identifier, '')), ''),
    coalesce(p_summary, '{}'::jsonb),
    p_started_at,
    p_completed_at
  ) returning id into v_run_id;

  insert into public.lead_sheet_audit_record_versions (
    data_source_id,
    record_key,
    content_hash,
    key_version,
    subject_label,
    payload_ciphertext,
    payload_iv,
    payload_auth_tag,
    first_seen_at
  )
  select
    p_data_source_id,
    item ->> 'recordKey',
    item ->> 'contentHash',
    item ->> 'keyVersion',
    item ->> 'subjectLabel',
    item ->> 'ciphertext',
    item ->> 'iv',
    item ->> 'authTag',
    p_completed_at
  from jsonb_array_elements(coalesce(p_versions, '[]'::jsonb)) as input(item)
  on conflict (data_source_id, record_key, content_hash) do nothing;

  insert into public.lead_sheet_audit_snapshot_entries (
    run_id,
    record_version_id,
    record_key,
    row_number
  )
  select
    v_run_id,
    version.id,
    item ->> 'recordKey',
    (item ->> 'rowNumber')::integer
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as input(item)
  join public.lead_sheet_audit_record_versions as version
    on version.data_source_id = p_data_source_id
   and version.record_key = item ->> 'recordKey'
   and version.content_hash = item ->> 'contentHash';

  get diagnostics v_inserted_entries = row_count;
  if v_inserted_entries <> p_row_count then
    raise exception using errcode = '23514', message = 'lead_audit_snapshot_entry_count_mismatch';
  end if;

  insert into public.lead_sheet_audit_changes (
    run_id,
    brand_id,
    record_key,
    subject_label,
    change_type,
    severity,
    risk_code,
    summary,
    changed_fields,
    before_version_id,
    after_version_id,
    review_status
  )
  select
    v_run_id,
    nullif(item ->> 'brandId', '')::uuid,
    nullif(item ->> 'recordKey', ''),
    item ->> 'subjectLabel',
    item ->> 'changeType',
    item ->> 'severity',
    item ->> 'riskCode',
    item ->> 'summary',
    coalesce(
      array(select jsonb_array_elements_text(item -> 'changedFields')),
      array[]::text[]
    ),
    before_version.id,
    after_version.id,
    case when item ->> 'severity' = 'info' then 'informational' else 'open' end
  from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) as input(item)
  left join public.lead_sheet_audit_record_versions as before_version
    on before_version.data_source_id = p_data_source_id
   and before_version.record_key = item ->> 'recordKey'
   and before_version.content_hash = item ->> 'beforeContentHash'
  left join public.lead_sheet_audit_record_versions as after_version
    on after_version.data_source_id = p_data_source_id
   and after_version.record_key = item ->> 'recordKey'
   and after_version.content_hash = item ->> 'afterContentHash';

  select
    count(*) filter (where change_type = 'added'),
    count(*) filter (where change_type = 'modified'),
    count(*) filter (where change_type = 'deleted'),
    count(*) filter (where severity = 'warning'),
    count(*) filter (where severity = 'critical'),
    count(*) filter (where review_status = 'open')
  into v_added, v_modified, v_deleted, v_warning, v_critical, v_open_alerts
  from public.lead_sheet_audit_changes
  where run_id = v_run_id;

  update public.lead_sheet_audit_runs
  set
    added_count = v_added,
    modified_count = v_modified,
    deleted_count = v_deleted,
    warning_count = v_warning,
    critical_count = v_critical
  where id = v_run_id;

  return jsonb_build_object(
    'runId', v_run_id,
    'status', p_status,
    'openAlerts', v_open_alerts,
    'warningCount', v_warning,
    'criticalCount', v_critical
  );
end;
$$;

revoke all on function public.commit_lead_sheet_audit_snapshot(
  uuid, uuid, text, text, integer, text, text, text, jsonb, jsonb, jsonb,
  jsonb, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.commit_lead_sheet_audit_snapshot(
  uuid, uuid, text, text, integer, text, text, text, jsonb, jsonb, jsonb,
  jsonb, timestamptz, timestamptz
) to service_role;

create or replace function public.review_lead_sheet_audit_change(
  p_change_id uuid,
  p_member_id uuid,
  p_actor_email text,
  p_review_status text,
  p_review_note text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if p_review_status not in ('reviewed', 'expected', 'dismissed')
    or length(coalesce(p_review_note, '')) > 1000
  then
    raise exception using errcode = '22023', message = 'invalid_lead_audit_review';
  end if;

  update public.lead_sheet_audit_changes
  set
    review_status = p_review_status,
    review_note = nullif(btrim(coalesce(p_review_note, '')), ''),
    reviewed_by_member_id = p_member_id,
    reviewed_by_email = nullif(btrim(coalesce(p_actor_email, '')), ''),
    reviewed_at = now()
  where id = p_change_id
    and review_status = 'open';

  if not found then
    raise exception using errcode = 'P0002', message = 'open_lead_audit_change_not_found';
  end if;
end;
$$;

revoke all on function public.review_lead_sheet_audit_change(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.review_lead_sheet_audit_change(uuid, uuid, text, text, text)
  to service_role;

-- Extend the explicit workspace-module permission without changing any role's
-- defaults. Master keeps implicit full access; every other member needs this
-- module to be explicitly assigned.
alter table public.workspace_member_module_permissions
  drop constraint if exists workspace_member_module_permissions_key_check;
alter table public.workspace_member_module_permissions
  add constraint workspace_member_module_permissions_key_check
  check (module_key in (
    'dashboard',
    'kpis',
    'calendar',
    'launchhub',
    'leads',
    'crm',
    'performance',
    'data_sources',
    'settings',
    'system_audit',
    'lead_audit'
  ));

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
volatile
security invoker
set search_path = ''
as $$
declare
  v_member_id uuid;
begin
  if exists (
    select 1 from unnest(coalesce(p_module_keys, array[]::text[])) requested(module_key)
    where requested.module_key not in (
      'dashboard', 'kpis', 'calendar', 'launchhub', 'leads', 'crm',
      'performance', 'data_sources', 'settings', 'system_audit', 'lead_audit'
    )
  ) then
    raise exception using errcode = '22023', message = 'invalid_member_module';
  end if;

  v_member_id := public.create_workspace_member_invitation(
    p_email,
    p_full_name,
    p_workspace_role,
    p_brand_ids,
    array_remove(coalesce(p_module_keys, array[]::text[]), 'lead_audit'),
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
volatile
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(coalesce(p_module_keys, array[]::text[])) requested(module_key)
    where requested.module_key not in (
      'dashboard', 'kpis', 'calendar', 'launchhub', 'leads', 'crm',
      'performance', 'data_sources', 'settings', 'system_audit', 'lead_audit'
    )
  ) then
    raise exception using errcode = '22023', message = 'invalid_member_module';
  end if;

  perform public.update_workspace_member_access(
    p_member_id,
    p_full_name,
    p_workspace_role,
    p_brand_ids,
    array_remove(coalesce(p_module_keys, array[]::text[]), 'lead_audit')
  );

  if 'lead_audit' = any(coalesce(p_module_keys, array[]::text[])) then
    insert into public.workspace_member_module_permissions (
      member_id, module_key, can_access, created_at, updated_at
    ) values (p_member_id, 'lead_audit', true, now(), now())
    on conflict (member_id, module_key) do update
      set can_access = true, updated_at = excluded.updated_at;
  end if;
end;
$$;

revoke all on function public.create_workspace_member_invitation_with_audit_access(
  text, text, text, uuid[], text[], uuid, text
) from public, anon, authenticated;
grant execute on function public.create_workspace_member_invitation_with_audit_access(
  text, text, text, uuid[], text[], uuid, text
) to service_role;
revoke all on function public.update_workspace_member_access_with_audit_access(
  uuid, text, text, uuid[], text[]
) from public, anon, authenticated;
grant execute on function public.update_workspace_member_access_with_audit_access(
  uuid, text, text, uuid[], text[]
) to service_role;
