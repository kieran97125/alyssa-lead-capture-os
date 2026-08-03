-- Period-versioned Google Sheets workbook registry for Alyssa monthly reporting.
--
-- One workbook is registered per reporting month. Brand-specific data sources
-- remain the metric ingestion boundary, while the parent workbook preserves
-- the original link, validation state and supersession history.

create table if not exists public.marketing_reporting_workbooks (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null default 'google_sheets',
  reporting_month date not null,
  spreadsheet_id text not null,
  title text not null,
  locale text null,
  time_zone text null,
  status text not null default 'active',
  validation_status text not null default 'pending',
  last_sync_status text not null default 'pending',
  sheet_manifest jsonb not null default '[]'::jsonb,
  validation_summary jsonb not null default '{}'::jsonb,
  sheet_count integer not null default 0,
  linked_brand_count integer not null default 0,
  last_validated_at timestamptz null,
  last_sync_at timestamptz null,
  last_success_at timestamptz null,
  last_error_summary text null,
  created_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_reporting_workbooks_provider_check
    check (provider_key = 'google_sheets'),
  constraint marketing_reporting_workbooks_month_check
    check (reporting_month = date_trunc('month', reporting_month)::date),
  constraint marketing_reporting_workbooks_spreadsheet_id_check
    check (spreadsheet_id ~ '^[A-Za-z0-9_-]{20,}$'),
  constraint marketing_reporting_workbooks_spreadsheet_id_key
    unique (spreadsheet_id),
  constraint marketing_reporting_workbooks_status_check
    check (status in ('active', 'superseded', 'archived')),
  constraint marketing_reporting_workbooks_validation_check
    check (validation_status in ('pending', 'valid', 'warning', 'error')),
  constraint marketing_reporting_workbooks_sync_check
    check (last_sync_status in ('pending', 'syncing', 'success', 'partial', 'error')),
  constraint marketing_reporting_workbooks_manifest_check
    check (jsonb_typeof(sheet_manifest) = 'array'),
  constraint marketing_reporting_workbooks_validation_summary_check
    check (jsonb_typeof(validation_summary) = 'object'),
  constraint marketing_reporting_workbooks_counts_check
    check (sheet_count >= 0 and linked_brand_count >= 0)
);

create unique index if not exists marketing_reporting_workbooks_active_month_idx
  on public.marketing_reporting_workbooks(provider_key, reporting_month)
  where status = 'active';

create index if not exists marketing_reporting_workbooks_history_idx
  on public.marketing_reporting_workbooks(reporting_month desc, created_at desc);

alter table public.marketing_data_sources
  add column if not exists reporting_workbook_id uuid null
    references public.marketing_reporting_workbooks(id) on delete set null;

create unique index if not exists marketing_data_sources_workbook_brand_idx
  on public.marketing_data_sources(reporting_workbook_id, brand_id)
  where reporting_workbook_id is not null;

create index if not exists marketing_data_sources_reporting_workbook_idx
  on public.marketing_data_sources(reporting_workbook_id, status);

alter table public.marketing_reporting_workbooks enable row level security;

-- This is an internal control-plane table. Browser roles remain deny-all;
-- explicit service-role privileges also cover Supabase's newer opt-in Data API
-- exposure behaviour for newly created tables.
revoke all on table public.marketing_reporting_workbooks
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.marketing_reporting_workbooks to service_role;

create or replace function public.register_marketing_reporting_workbook(
  p_reporting_month date,
  p_spreadsheet_id text,
  p_title text,
  p_locale text,
  p_time_zone text,
  p_sheet_manifest jsonb,
  p_source_mappings jsonb,
  p_validation_status text,
  p_validation_summary jsonb,
  p_actor_email text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workbook_id uuid;
  v_existing_month date;
  v_previous_workbook_ids uuid[] := '{}'::uuid[];
  v_source_ids uuid[] := '{}'::uuid[];
  v_mapping record;
  v_source_id uuid;
  v_mapping_count integer;
  v_distinct_brand_count integer;
begin
  if p_reporting_month is null
    or p_reporting_month <> date_trunc('month', p_reporting_month)::date then
    raise exception 'reporting_month_must_be_first_day';
  end if;
  if coalesce(p_spreadsheet_id, '') !~ '^[A-Za-z0-9_-]{20,}$' then
    raise exception 'invalid_spreadsheet_id';
  end if;
  if coalesce(trim(p_title), '') = '' or length(trim(p_title)) > 240 then
    raise exception 'invalid_workbook_title';
  end if;
  if jsonb_typeof(coalesce(p_sheet_manifest, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_source_mappings, 'null'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_validation_summary, 'null'::jsonb)) <> 'object' then
    raise exception 'invalid_workbook_manifest';
  end if;
  if p_validation_status not in ('valid', 'warning') then
    raise exception 'invalid_validation_status';
  end if;

  v_mapping_count := jsonb_array_length(p_source_mappings);
  if v_mapping_count = 0 then
    raise exception 'source_mapping_required';
  end if;

  select count(distinct mapping."brandId")
  into v_distinct_brand_count
  from jsonb_to_recordset(p_source_mappings) as mapping(
    "brandId" uuid,
    "brandName" text,
    "brandSlug" text,
    "tabName" text,
    "sheetId" integer,
    "headerRow" integer,
    "dateColumn" text,
    "spendColumn" text
  );
  if v_distinct_brand_count <> v_mapping_count then
    raise exception 'duplicate_brand_mapping';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_source_mappings) as mapping(
      "brandId" uuid,
      "brandName" text,
      "brandSlug" text,
      "tabName" text,
      "sheetId" integer,
      "headerRow" integer,
      "dateColumn" text,
      "spendColumn" text
    )
    left join public.brands on brands.id = mapping."brandId"
    where brands.id is null
      or coalesce(trim(mapping."tabName"), '') = ''
      or mapping."sheetId" is null
      or coalesce(mapping."headerRow", 0) < 1
      or coalesce(mapping."dateColumn", '') !~ '^[A-Z]{1,3}$'
      or coalesce(mapping."spendColumn", '') !~ '^[A-Z]{1,3}$'
  ) then
    raise exception 'invalid_brand_source_mapping';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('marketing_reporting_workbook:' || p_reporting_month::text)
  );

  select reporting_month
  into v_existing_month
  from public.marketing_reporting_workbooks
  where spreadsheet_id = p_spreadsheet_id
  for update;
  if v_existing_month is not null and v_existing_month <> p_reporting_month then
    raise exception 'spreadsheet_already_registered_for_another_month';
  end if;

  select coalesce(array_agg(active_workbooks.id), '{}'::uuid[])
  into v_previous_workbook_ids
  from (
    select id
    from public.marketing_reporting_workbooks
    where provider_key = 'google_sheets'
      and reporting_month = p_reporting_month
      and status = 'active'
      and spreadsheet_id <> p_spreadsheet_id
    for update
  ) as active_workbooks;

  update public.marketing_reporting_workbooks
  set
    status = 'superseded',
    updated_at = now()
  where id = any(v_previous_workbook_ids);

  update public.marketing_data_sources
  set
    status = 'paused',
    updated_at = now()
  where reporting_workbook_id = any(v_previous_workbook_ids)
    and status <> 'paused';

  insert into public.marketing_reporting_workbooks (
    provider_key,
    reporting_month,
    spreadsheet_id,
    title,
    locale,
    time_zone,
    status,
    validation_status,
    last_sync_status,
    sheet_manifest,
    validation_summary,
    sheet_count,
    linked_brand_count,
    last_validated_at,
    last_error_summary,
    created_by_email,
    updated_at
  ) values (
    'google_sheets',
    p_reporting_month,
    p_spreadsheet_id,
    trim(p_title),
    nullif(trim(p_locale), ''),
    nullif(trim(p_time_zone), ''),
    'active',
    p_validation_status,
    'pending',
    p_sheet_manifest,
    p_validation_summary,
    jsonb_array_length(p_sheet_manifest),
    v_mapping_count,
    now(),
    null,
    nullif(lower(trim(p_actor_email)), ''),
    now()
  )
  on conflict (spreadsheet_id) do update
  set
    title = excluded.title,
    locale = excluded.locale,
    time_zone = excluded.time_zone,
    status = 'active',
    validation_status = excluded.validation_status,
    last_sync_status = 'pending',
    sheet_manifest = excluded.sheet_manifest,
    validation_summary = excluded.validation_summary,
    sheet_count = excluded.sheet_count,
    linked_brand_count = excluded.linked_brand_count,
    last_validated_at = excluded.last_validated_at,
    last_error_summary = null,
    updated_at = now()
  returning id into v_workbook_id;

  update public.marketing_data_sources
  set
    status = 'paused',
    updated_at = now()
  where reporting_workbook_id = v_workbook_id
    and brand_id not in (
      select mapping."brandId"
      from jsonb_to_recordset(p_source_mappings) as mapping(
        "brandId" uuid,
        "brandName" text,
        "brandSlug" text,
        "tabName" text,
        "sheetId" integer,
        "headerRow" integer,
        "dateColumn" text,
        "spendColumn" text
      )
    );

  for v_mapping in
    select
      mapping."brandId" as brand_id,
      brands.name as brand_name,
      brands.slug as brand_slug,
      mapping."tabName" as tab_name,
      mapping."sheetId" as sheet_id,
      mapping."headerRow" as header_row,
      mapping."dateColumn" as date_column,
      mapping."spendColumn" as spend_column
    from jsonb_to_recordset(p_source_mappings) as mapping(
      "brandId" uuid,
      "brandName" text,
      "brandSlug" text,
      "tabName" text,
      "sheetId" integer,
      "headerRow" integer,
      "dateColumn" text,
      "spendColumn" text
    )
    join public.brands on brands.id = mapping."brandId"
  loop
    insert into public.marketing_data_sources (
      brand_id,
      provider_key,
      display_name,
      status,
      sync_mode,
      configuration,
      provides_metrics,
      reporting_workbook_id,
      updated_at
    ) values (
      v_mapping.brand_id,
      'google_sheets',
      v_mapping.brand_name || ' · ' || to_char(p_reporting_month, 'YYYY-MM') || ' 月份數據',
      'draft',
      'manual',
      jsonb_build_object(
        'sourceProfile', 'monthly_overview_daily_spend',
        'schemaProfile', 'monthly_overview_v1',
        'dataset', 'daily_spend',
        'reportingMonth', p_reporting_month,
        'spreadsheetId', p_spreadsheet_id,
        'workbookTitle', trim(p_title),
        'tabName', v_mapping.tab_name,
        'sheetId', v_mapping.sheet_id,
        'headerRow', v_mapping.header_row,
        'maxRows', 5000,
        'dateColumn', v_mapping.date_column,
        'spendColumn', v_mapping.spend_column
      ),
      array['spend']::text[],
      v_workbook_id,
      now()
    )
    on conflict (reporting_workbook_id, brand_id)
      where reporting_workbook_id is not null
    do update set
      display_name = excluded.display_name,
      status = case
        when public.marketing_data_sources.status in ('connected', 'syncing')
          then public.marketing_data_sources.status
        else 'draft'
      end,
      configuration = excluded.configuration,
      provides_metrics = excluded.provides_metrics,
      updated_at = now()
    returning id into v_source_id;
    v_source_ids := array_append(v_source_ids, v_source_id);
  end loop;

  insert into public.marketing_command_center_audit (
    actor_email,
    action,
    entity_type,
    entity_id,
    after_json
  ) values (
    nullif(lower(trim(p_actor_email)), ''),
    'reporting_workbook.registered',
    'marketing_reporting_workbook',
    v_workbook_id::text,
    jsonb_build_object(
      'reportingMonth', p_reporting_month,
      'spreadsheetId', p_spreadsheet_id,
      'title', trim(p_title),
      'sourceCount', cardinality(v_source_ids),
      'supersededWorkbookIds', to_jsonb(v_previous_workbook_ids)
    )
  );

  return jsonb_build_object(
    'workbookId', v_workbook_id,
    'sourceIds', to_jsonb(v_source_ids)
  );
end;
$$;

revoke all on function public.register_marketing_reporting_workbook(
  date, text, text, text, text, jsonb, jsonb, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.register_marketing_reporting_workbook(
  date, text, text, text, text, jsonb, jsonb, text, jsonb, text
) to service_role;

comment on table public.marketing_reporting_workbooks is
  'Server-only period-versioned registry of monthly reporting workbooks. The active row owns the canonical link for its month; superseded rows remain as history.';
comment on column public.marketing_data_sources.reporting_workbook_id is
  'Optional parent monthly workbook. Null sources, including the raw Lead Sheet, remain independent authoritative inputs.';

-- Backfill the known July 2026 workbook into the new parent registry without
-- touching the independent raw Lead Funnel source.
insert into public.marketing_reporting_workbooks (
  reporting_month,
  spreadsheet_id,
  title,
  status,
  validation_status,
  last_sync_status,
  sheet_manifest,
  validation_summary,
  sheet_count,
  linked_brand_count,
  last_validated_at,
  created_by_email
)
select
  date '2026-07-01',
  '1C0nXpBCQC7ROsL1LSonw8CBppihIVIt_zFPaJ_NvDjE',
  'July Overview_Alyssa_2026',
  'active',
  'warning',
  'pending',
  '[{"title":"Alyssa","hidden":false},{"title":"IB","hidden":false},{"title":"GOS","hidden":false}]'::jsonb,
  '{"warnings":["Backfilled from the existing Alyssa source registry; run an explicit sync to refresh validation evidence."]}'::jsonb,
  3,
  2,
  now(),
  'migration_backfill'
where exists (
  select 1
  from public.marketing_data_sources
  where provider_key = 'google_sheets'
    and configuration ->> 'spreadsheetId' =
      '1C0nXpBCQC7ROsL1LSonw8CBppihIVIt_zFPaJ_NvDjE'
    and configuration ->> 'dataset' = 'daily_spend'
)
on conflict (spreadsheet_id) do nothing;

-- The August workbook supplied for this release was inspected through the
-- connected Google Drive integration. AM is intentionally left unmatched;
-- Alyssa, IB and GOS are the recognised brand metric tabs.
insert into public.marketing_reporting_workbooks (
  reporting_month,
  spreadsheet_id,
  title,
  locale,
  time_zone,
  status,
  validation_status,
  last_sync_status,
  sheet_manifest,
  validation_summary,
  sheet_count,
  linked_brand_count,
  last_validated_at,
  created_by_email
) values (
  date '2026-08-01',
  '1HqOt0TYM8dtOpb5RgChTIeFt4hqX_SBirPz29NMAbFE',
  'August Overview_Alyssa_2026',
  'zh_TW',
  'Asia/Hong_Kong',
  'active',
  'warning',
  'pending',
  '[{"title":"Daily Overview","hidden":false},{"title":"Alyssa","hidden":false},{"title":"IB","hidden":false},{"title":"GOS","hidden":false},{"title":"AM","hidden":false},{"title":"UTM","hidden":false},{"title":"By brand","hidden":true},{"title":"Link","hidden":true},{"title":"Brand Template","hidden":true}]'::jsonb,
  '{"warnings":["AM is not mapped to a configured system brand and will not be imported."],"matchedTabs":["Alyssa","IB","GOS"]}'::jsonb,
  9,
  3,
  now(),
  'release_import'
)
on conflict (spreadsheet_id) do nothing;

update public.marketing_data_sources as sources
set
  reporting_workbook_id = workbooks.id,
  configuration = sources.configuration || jsonb_build_object(
    'schemaProfile', 'monthly_overview_v1',
    'reportingMonth', '2026-07-01',
    'workbookTitle', workbooks.title
  ),
  updated_at = now()
from public.marketing_reporting_workbooks as workbooks
where workbooks.spreadsheet_id =
    '1C0nXpBCQC7ROsL1LSonw8CBppihIVIt_zFPaJ_NvDjE'
  and sources.provider_key = 'google_sheets'
  and sources.configuration ->> 'spreadsheetId' = workbooks.spreadsheet_id
  and sources.configuration ->> 'dataset' = 'daily_spend'
  and sources.reporting_workbook_id is null;

insert into public.marketing_data_sources (
  brand_id,
  provider_key,
  display_name,
  status,
  sync_mode,
  configuration,
  provides_metrics,
  reporting_workbook_id
)
select
  brands.id,
  'google_sheets',
  brands.name || ' · 2026-07 月份數據',
  'draft',
  'manual',
  jsonb_build_object(
    'sourceProfile', 'monthly_overview_daily_spend',
    'schemaProfile', 'monthly_overview_v1',
    'dataset', 'daily_spend',
    'reportingMonth', '2026-07-01',
    'spreadsheetId', workbooks.spreadsheet_id,
    'workbookTitle', workbooks.title,
    'tabName', 'GOS',
    'headerRow', 3,
    'maxRows', 5000,
    'dateColumn', 'A',
    'spendColumn', 'N'
  ),
  array['spend']::text[],
  workbooks.id
from public.brands
join public.marketing_reporting_workbooks as workbooks
  on workbooks.spreadsheet_id =
    '1C0nXpBCQC7ROsL1LSonw8CBppihIVIt_zFPaJ_NvDjE'
where lower(brands.slug) in ('gos', 'gos-beauty')
  and not exists (
    select 1
    from public.marketing_data_sources as sources
    where sources.reporting_workbook_id = workbooks.id
      and sources.brand_id = brands.id
  );

insert into public.marketing_data_sources (
  brand_id,
  provider_key,
  display_name,
  status,
  sync_mode,
  configuration,
  provides_metrics,
  reporting_workbook_id
)
select
  brands.id,
  'google_sheets',
  brands.name || ' · 2026-08 月份數據',
  'draft',
  'manual',
  jsonb_build_object(
    'sourceProfile', 'monthly_overview_daily_spend',
    'schemaProfile', 'monthly_overview_v1',
    'dataset', 'daily_spend',
    'reportingMonth', '2026-08-01',
    'spreadsheetId', workbooks.spreadsheet_id,
    'workbookTitle', workbooks.title,
    'tabName', case
      when lower(brands.slug) = 'alyssa' then 'Alyssa'
      when lower(brands.slug) in ('ineffable', 'ineffable-beauty') then 'IB'
      else 'GOS'
    end,
    'headerRow', 3,
    'maxRows', 5000,
    'dateColumn', 'A',
    'spendColumn', 'N'
  ),
  array['spend']::text[],
  workbooks.id
from public.brands
join public.marketing_reporting_workbooks as workbooks
  on workbooks.spreadsheet_id =
    '1HqOt0TYM8dtOpb5RgChTIeFt4hqX_SBirPz29NMAbFE'
where lower(brands.slug) in (
  'alyssa',
  'ineffable',
  'ineffable-beauty',
  'gos',
  'gos-beauty'
)
  and not exists (
    select 1
    from public.marketing_data_sources as sources
    where sources.reporting_workbook_id = workbooks.id
      and sources.brand_id = brands.id
  );

update public.marketing_reporting_workbooks as workbooks
set
  linked_brand_count = children.source_count,
  updated_at = now()
from (
  select reporting_workbook_id, count(*)::integer as source_count
  from public.marketing_data_sources
  where reporting_workbook_id is not null
  group by reporting_workbook_id
) as children
where workbooks.id = children.reporting_workbook_id;
