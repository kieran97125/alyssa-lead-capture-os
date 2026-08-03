-- Promote the existing AM reporting tab into a first-class system brand.
--
-- Future monthly workbook registration automatically discovers AM through the
-- generic brand-to-tab matcher. This migration also reconciles any already
-- registered active workbook that contains a visible AM tab, without granting
-- existing non-Master members access to the new brand.

insert into public.brands (
  id,
  name,
  slug,
  logo_url,
  primary_color,
  secondary_color,
  whatsapp_number,
  default_thank_you_url,
  updated_at
) values (
  '4a4d0000-0000-4000-8000-000000000001',
  'AM',
  'am',
  null,
  '#8E5B71',
  '#F3E7EC',
  null,
  null,
  now()
)
on conflict (slug) do update
set
  name = excluded.name,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  logo_url = null,
  updated_at = now();

update public.marketing_data_sources
set
  configuration = jsonb_set(
    configuration,
    '{brandAliases}',
    coalesce(configuration -> 'brandAliases', '{}'::jsonb) ||
      '{"AM":"am"}'::jsonb,
    true
  ),
  updated_at = now()
where provider_key = 'google_sheets'
  and configuration ->> 'dataset' = 'lead_funnel'
  and status = 'connected';

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
)
select
  brands.id,
  'google_sheets',
  brands.name || ' · ' || to_char(workbooks.reporting_month, 'YYYY-MM') ||
    ' 月份數據',
  'draft',
  'manual',
  jsonb_build_object(
    'sourceProfile', 'monthly_overview_daily_spend',
    'schemaProfile', 'monthly_overview_v1',
    'dataset', 'daily_spend',
    'reportingMonth', workbooks.reporting_month,
    'spreadsheetId', workbooks.spreadsheet_id,
    'workbookTitle', workbooks.title,
    'tabName', 'AM',
    'headerRow', 3,
    'maxRows', 5000,
    'dateColumn', 'A',
    'spendColumn', 'N'
  ),
  array['spend']::text[],
  workbooks.id,
  now()
from public.brands
join public.marketing_reporting_workbooks as workbooks
  on workbooks.status = 'active'
where lower(brands.slug) = 'am'
  and exists (
    select 1
    from jsonb_array_elements(workbooks.sheet_manifest) as sheet
    where lower(trim(sheet ->> 'title')) = 'am'
      and coalesce((sheet ->> 'hidden')::boolean, false) = false
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
  validation_status = case
    when coalesce(jsonb_array_length(workbooks.validation_summary -> 'warnings'), 0) = 0
      or (
        jsonb_array_length(workbooks.validation_summary -> 'warnings') = 1
        and lower(workbooks.validation_summary -> 'warnings' ->> 0)
          like 'am is not mapped%'
      )
      then 'valid'
    else workbooks.validation_status
  end,
  validation_summary = jsonb_set(
    jsonb_set(
      coalesce(workbooks.validation_summary, '{}'::jsonb),
      '{warnings}',
      case
        when coalesce(jsonb_array_length(workbooks.validation_summary -> 'warnings'), 0) = 0
          or (
            jsonb_array_length(workbooks.validation_summary -> 'warnings') = 1
            and lower(workbooks.validation_summary -> 'warnings' ->> 0)
              like 'am is not mapped%'
          )
          then '[]'::jsonb
        else coalesce(workbooks.validation_summary -> 'warnings', '[]'::jsonb)
      end,
      true
    ),
    '{matchedTabs}',
    case
      when coalesce(workbooks.validation_summary -> 'matchedTabs', '[]'::jsonb)
        @> '["AM"]'::jsonb
        then coalesce(workbooks.validation_summary -> 'matchedTabs', '[]'::jsonb)
      else coalesce(workbooks.validation_summary -> 'matchedTabs', '[]'::jsonb)
        || '["AM"]'::jsonb
    end,
    true
  ) || jsonb_build_object('amBrandActivated', true),
  last_sync_status = 'pending',
  last_error_summary = case
    when coalesce(jsonb_array_length(workbooks.validation_summary -> 'warnings'), 0) = 0
      or (
        jsonb_array_length(workbooks.validation_summary -> 'warnings') = 1
        and lower(workbooks.validation_summary -> 'warnings' ->> 0)
          like 'am is not mapped%'
      )
      then null
    else workbooks.last_error_summary
  end,
  last_validated_at = now(),
  updated_at = now()
from (
  select reporting_workbook_id, count(*)::integer as source_count
  from public.marketing_data_sources
  where reporting_workbook_id is not null
  group by reporting_workbook_id
) as children
where workbooks.id = children.reporting_workbook_id
  and workbooks.status = 'active'
  and exists (
    select 1
    from jsonb_array_elements(workbooks.sheet_manifest) as sheet
    where lower(trim(sheet ->> 'title')) = 'am'
      and coalesce((sheet ->> 'hidden')::boolean, false) = false
  );

insert into public.marketing_command_center_audit (
  actor_email,
  action,
  entity_type,
  entity_id,
  brand_id,
  after_json
)
select
  'migration_am_brand_activation',
  'brand.reporting_activated',
  'brand',
  brands.id::text,
  brands.id,
  jsonb_build_object(
    'brandSlug', brands.slug,
    'reportingSourceCount', count(sources.id),
    'memberAccessExpanded', false
  )
from public.brands
left join public.marketing_data_sources as sources
  on sources.brand_id = brands.id
  and sources.reporting_workbook_id is not null
where lower(brands.slug) = 'am'
group by brands.id, brands.slug;
