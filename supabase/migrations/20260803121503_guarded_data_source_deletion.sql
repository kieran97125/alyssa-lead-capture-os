
create or replace function public.delete_marketing_data_source(
  p_data_source_id uuid,
  p_actor_identifier text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.marketing_data_sources%rowtype;
  v_daily_metric_rows integer := 0;
  v_treatment_performance_rows integer := 0;
begin
  select *
  into v_source
  from public.marketing_data_sources
  where id = p_data_source_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  end if;

  if v_source.provider_key = 'internal_ledger'
    or v_source.reporting_workbook_id is not null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'protected_source',
      'displayName', v_source.display_name
    );
  end if;

  select count(*)::integer
  into v_daily_metric_rows
  from public.marketing_daily_metrics
  where data_source_id = p_data_source_id;

  select count(*)::integer
  into v_treatment_performance_rows
  from public.marketing_treatment_performance_daily
  where data_source_id = p_data_source_id;

  delete from public.marketing_daily_metrics
  where data_source_id = p_data_source_id;

  delete from public.marketing_data_sources
  where id = p_data_source_id;

  insert into public.marketing_command_center_audit (
    actor_email,
    action,
    entity_type,
    entity_id,
    brand_id,
    before_json,
    after_json
  ) values (
    coalesce(nullif(btrim(p_actor_identifier), ''), 'unknown_actor'),
    'data_source.deleted',
    'marketing_data_source',
    v_source.id::text,
    v_source.brand_id,
    to_jsonb(v_source) - 'credential_reference',
    jsonb_build_object(
      'dailyMetricRowsDeleted', v_daily_metric_rows,
      'treatmentPerformanceRowsDeleted', v_treatment_performance_rows
    )
  );

  return jsonb_build_object(
    'ok', true,
    'displayName', v_source.display_name,
    'dailyMetricRowsDeleted', v_daily_metric_rows,
    'treatmentPerformanceRowsDeleted', v_treatment_performance_rows
  );
end
$$;

revoke all on function public.delete_marketing_data_source(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_marketing_data_source(uuid, text)
  to service_role;

comment on function public.delete_marketing_data_source(uuid, text) is
  'Atomically deletes an operator-managed data source and its derived aggregates while protecting system ledgers and retired reporting lineage.';

