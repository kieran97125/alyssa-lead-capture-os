-- Internal daily advertising-spend ledger.
--
-- This replaces the month-by-month Google Sheets spend connector as the
-- canonical Spend source while preserving the existing workbook registry as
-- read-only lineage. Lead, Book and Show remain owned by the CS Lead Sheet.

create table if not exists public.marketing_daily_spend_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  spend_date date not null,
  spend_type text not null,
  amount numeric(14,2) not null check (amount >= 0 and amount <= 99999999.99),
  currency text not null default 'HKD',
  entry_method text not null default 'manual',
  source_reference text null,
  note text null,
  revision integer not null default 1 check (revision > 0),
  created_by_email text null,
  updated_by_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, spend_date, spend_type),
  constraint marketing_daily_spend_entries_type_check
    check (spend_type in (
      'meta_whatsapp',
      'meta_lead_form',
      'meta_website_form',
      'google_ads',
      'legacy_unclassified'
    )),
  constraint marketing_daily_spend_entries_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint marketing_daily_spend_entries_method_check
    check (entry_method in ('manual', 'legacy_import', 'provider_rollup')),
  constraint marketing_daily_spend_entries_note_check
    check (note is null or length(note) <= 500)
);

create index if not exists marketing_daily_spend_entries_date_brand_type_idx
  on public.marketing_daily_spend_entries(
    spend_date desc,
    brand_id,
    spend_type
  );

alter table public.marketing_daily_spend_entries enable row level security;

-- The ledger is an internal control-plane table. Browser roles are explicitly
-- denied even when a project's Data API exposure defaults change.
revoke all on table public.marketing_daily_spend_entries
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.marketing_daily_spend_entries to service_role;

alter table public.marketing_data_sources
  drop constraint if exists marketing_data_sources_provider_check;

alter table public.marketing_data_sources
  add constraint marketing_data_sources_provider_check
  check (provider_key in (
    'launchhub',
    'crm',
    'google_sheets',
    'meta_ads',
    'google_ads',
    'manual_csv',
    'n8n',
    'internal_ledger'
  ));

create unique index if not exists marketing_data_sources_internal_spend_brand_idx
  on public.marketing_data_sources(brand_id)
  where provider_key = 'internal_ledger'
    and configuration ->> 'dataset' = 'daily_spend_ledger';

insert into public.marketing_data_sources (
  brand_id,
  provider_key,
  display_name,
  status,
  sync_mode,
  configuration,
  provides_metrics,
  last_sync_at,
  last_success_at
)
select
  brands.id,
  'internal_ledger',
  brands.name || ' · 系統每日廣告費',
  'connected',
  'native',
  jsonb_build_object(
    'dataset', 'daily_spend_ledger',
    'sourceProfile', 'internal_daily_spend',
    'currency', 'HKD',
    'spendTypes', jsonb_build_array(
      'meta_whatsapp',
      'meta_lead_form',
      'meta_website_form',
      'google_ads'
    )
  ),
  array['spend']::text[],
  now(),
  now()
from public.brands as brands
where not exists (
  select 1
  from public.marketing_data_sources as sources
  where sources.brand_id = brands.id
    and sources.provider_key = 'internal_ledger'
    and sources.configuration ->> 'dataset' = 'daily_spend_ledger'
);

-- Seed the new ledger from the canonical legacy source once. Active monthly
-- workbook rows win over standalone historical Spend sources for the same
-- brand and date, preventing double counting during cutover.
with workbook_spend as (
  select
    metrics.brand_id,
    metrics.metric_date as spend_date,
    sum(metrics.spend)::numeric(14,2) as amount,
    min(sources.id::text) as source_reference
  from public.marketing_daily_metrics as metrics
  join public.marketing_data_sources as sources
    on sources.id = metrics.data_source_id
  join public.marketing_reporting_workbooks as workbooks
    on workbooks.id = sources.reporting_workbook_id
  where sources.configuration ->> 'dataset' = 'daily_spend'
    and workbooks.status = 'active'
    and workbooks.reporting_month = date_trunc('month', metrics.metric_date)::date
  group by metrics.brand_id, metrics.metric_date
),
standalone_ranked as (
  select
    metrics.brand_id,
    metrics.metric_date as spend_date,
    metrics.spend::numeric(14,2) as amount,
    sources.id::text as source_reference,
    row_number() over (
      partition by metrics.brand_id, metrics.metric_date
      order by
        case sources.status
          when 'connected' then 5
          when 'syncing' then 4
          when 'warning' then 3
          when 'draft' then 2
          when 'paused' then 1
          else 0
        end desc,
        sources.last_success_at desc nulls last,
        sources.id desc
    ) as source_rank
  from public.marketing_daily_metrics as metrics
  join public.marketing_data_sources as sources
    on sources.id = metrics.data_source_id
  where sources.configuration ->> 'dataset' = 'daily_spend'
    and sources.reporting_workbook_id is null
),
canonical_spend as (
  select
    workbook_spend.brand_id,
    workbook_spend.spend_date,
    workbook_spend.amount,
    'marketing_data_source:' || workbook_spend.source_reference as source_reference
  from workbook_spend
  union all
  select
    standalone_ranked.brand_id,
    standalone_ranked.spend_date,
    standalone_ranked.amount,
    'marketing_data_source:' || standalone_ranked.source_reference
  from standalone_ranked
  where standalone_ranked.source_rank = 1
    and not exists (
      select 1
      from workbook_spend
      where workbook_spend.brand_id = standalone_ranked.brand_id
        and workbook_spend.spend_date = standalone_ranked.spend_date
    )
)
insert into public.marketing_daily_spend_entries (
  brand_id,
  spend_date,
  spend_type,
  amount,
  currency,
  entry_method,
  source_reference,
  note,
  created_by_email,
  updated_by_email
)
select
  canonical_spend.brand_id,
  canonical_spend.spend_date,
  'legacy_unclassified',
  canonical_spend.amount,
  'HKD',
  'legacy_import',
  canonical_spend.source_reference,
  '由舊月份廣告費來源安全搬入',
  'system:migration',
  'system:migration'
from canonical_spend
on conflict (brand_id, spend_date, spend_type) do nothing;

-- Keep workbook links and imported rows for lineage, but stop future Spend
-- synchronization. The old application remains readable during the short
-- migration-before-deploy window because its historical metric rows remain.
update public.marketing_data_sources
set
  status = 'paused',
  configuration = configuration || jsonb_build_object(
    'retiredTo', 'internal_daily_spend',
    'retiredAt', now()
  ),
  last_error_summary = null,
  updated_at = now()
where configuration ->> 'dataset' = 'daily_spend'
  and provider_key <> 'internal_ledger';

create or replace function public.save_marketing_daily_spend(
  p_spend_date date,
  p_spend_type text,
  p_entries jsonb,
  p_actor_email text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_entry record;
  v_before jsonb;
  v_after jsonb;
  v_entry_id uuid;
  v_saved_count integer := 0;
  v_deleted_count integer := 0;
  v_entry_count integer;
  v_brand_count integer;
begin
  if p_spend_date is null then
    raise exception 'spend_date_required';
  end if;
  if p_spend_date > (now() at time zone 'Asia/Hong_Kong')::date then
    raise exception 'future_spend_date_not_allowed';
  end if;
  if p_spend_type is null or p_spend_type not in (
    'meta_whatsapp',
    'meta_lead_form',
    'meta_website_form',
    'google_ads'
  ) then
    raise exception 'invalid_spend_type';
  end if;
  if jsonb_typeof(coalesce(p_entries, 'null'::jsonb)) <> 'array' then
    raise exception 'spend_entries_must_be_array';
  end if;
  if coalesce(trim(p_actor_email), '') = '' or length(trim(p_actor_email)) > 320 then
    raise exception 'spend_actor_required';
  end if;

  select count(*), count(distinct entries."brandId")
  into v_entry_count, v_brand_count
  from jsonb_to_recordset(p_entries) as entries(
    "brandId" uuid,
    amount numeric,
    note text
  );

  if v_entry_count = 0 or v_entry_count > 50 then
    raise exception 'invalid_spend_entry_count';
  end if;
  if v_entry_count <> v_brand_count then
    raise exception 'duplicate_spend_brand';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_entries) as entries(
      "brandId" uuid,
      amount numeric,
      note text
    )
    left join public.brands as brands on brands.id = entries."brandId"
    where entries."brandId" is null
      or brands.id is null
      or entries.amount < 0
      or entries.amount > 99999999.99
      or length(coalesce(entries.note, '')) > 500
  ) then
    raise exception 'invalid_spend_entry';
  end if;

  for v_entry in
    select
      entries."brandId" as brand_id,
      entries.amount,
      nullif(trim(entries.note), '') as note
    from jsonb_to_recordset(p_entries) as entries(
      "brandId" uuid,
      amount numeric,
      note text
    )
  loop
    select jsonb_build_object(
      'id', ledger.id,
      'brandId', ledger.brand_id,
      'spendDate', ledger.spend_date,
      'spendType', ledger.spend_type,
      'amount', ledger.amount,
      'currency', ledger.currency,
      'entryMethod', ledger.entry_method,
      'note', ledger.note,
      'revision', ledger.revision,
      'updatedBy', ledger.updated_by_email,
      'updatedAt', ledger.updated_at
    )
    into v_before
    from public.marketing_daily_spend_entries as ledger
    where ledger.brand_id = v_entry.brand_id
      and ledger.spend_date = p_spend_date
      and ledger.spend_type = p_spend_type;

    if v_entry.amount is null then
      delete from public.marketing_daily_spend_entries as ledger
      where ledger.brand_id = v_entry.brand_id
        and ledger.spend_date = p_spend_date
        and ledger.spend_type = p_spend_type
      returning ledger.id into v_entry_id;

      if v_entry_id is not null then
        insert into public.marketing_command_center_audit (
          actor_email,
          action,
          entity_type,
          entity_id,
          brand_id,
          before_json,
          after_json
        ) values (
          trim(p_actor_email),
          'daily_spend.deleted',
          'marketing_daily_spend',
          v_entry_id::text,
          v_entry.brand_id,
          v_before,
          null
        );
        v_deleted_count := v_deleted_count + 1;
      end if;
    else
      insert into public.marketing_daily_spend_entries (
        brand_id,
        spend_date,
        spend_type,
        amount,
        currency,
        entry_method,
        source_reference,
        note,
        revision,
        created_by_email,
        updated_by_email,
        updated_at
      ) values (
        v_entry.brand_id,
        p_spend_date,
        p_spend_type,
        v_entry.amount,
        'HKD',
        'manual',
        null,
        v_entry.note,
        1,
        trim(p_actor_email),
        trim(p_actor_email),
        now()
      )
      on conflict (brand_id, spend_date, spend_type) do update
      set
        amount = excluded.amount,
        currency = excluded.currency,
        entry_method = 'manual',
        source_reference = null,
        note = excluded.note,
        revision = public.marketing_daily_spend_entries.revision + 1,
        updated_by_email = excluded.updated_by_email,
        updated_at = excluded.updated_at
      returning
        marketing_daily_spend_entries.id,
        jsonb_build_object(
          'id', marketing_daily_spend_entries.id,
          'brandId', marketing_daily_spend_entries.brand_id,
          'spendDate', marketing_daily_spend_entries.spend_date,
          'spendType', marketing_daily_spend_entries.spend_type,
          'amount', marketing_daily_spend_entries.amount,
          'currency', marketing_daily_spend_entries.currency,
          'entryMethod', marketing_daily_spend_entries.entry_method,
          'note', marketing_daily_spend_entries.note,
          'revision', marketing_daily_spend_entries.revision,
          'updatedBy', marketing_daily_spend_entries.updated_by_email,
          'updatedAt', marketing_daily_spend_entries.updated_at
        )
      into v_entry_id, v_after;

      insert into public.marketing_command_center_audit (
        actor_email,
        action,
        entity_type,
        entity_id,
        brand_id,
        before_json,
        after_json
      ) values (
        trim(p_actor_email),
        case when v_before is null
          then 'daily_spend.created'
          else 'daily_spend.updated'
        end,
        'marketing_daily_spend',
        v_entry_id::text,
        v_entry.brand_id,
        v_before,
        v_after
      );
      v_saved_count := v_saved_count + 1;
    end if;

    v_before := null;
    v_after := null;
    v_entry_id := null;
  end loop;

  update public.marketing_data_sources as sources
  set
    last_sync_at = now(),
    last_success_at = now(),
    last_error_summary = null,
    updated_at = now()
  where sources.provider_key = 'internal_ledger'
    and sources.configuration ->> 'dataset' = 'daily_spend_ledger'
    and sources.brand_id in (
      select entries."brandId"
      from jsonb_to_recordset(p_entries) as entries(
        "brandId" uuid,
        amount numeric,
        note text
      )
    );

  return jsonb_build_object(
    'spendDate', p_spend_date,
    'spendType', p_spend_type,
    'savedCount', v_saved_count,
    'deletedCount', v_deleted_count,
    'entryCount', v_entry_count
  );
end;
$$;

revoke all on function public.save_marketing_daily_spend(date, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.save_marketing_daily_spend(date, text, jsonb, text)
  to service_role;

comment on table public.marketing_daily_spend_entries is
  'Canonical brand, date and spend-type advertising ledger. Manual changes are written through save_marketing_daily_spend and mirrored to the Command Center audit log.';
comment on function public.save_marketing_daily_spend(date, text, jsonb, text) is
  'Atomically saves or clears one typed day of brand Spend entries and records before/after audit evidence. Null amount means clear; zero is a valid recorded amount.';
