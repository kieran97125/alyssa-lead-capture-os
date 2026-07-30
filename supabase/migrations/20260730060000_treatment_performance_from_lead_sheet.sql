-- Treatment Performance is an anonymous analytical projection of the
-- operator-owned Google Sheet `lead` tab. It deliberately excludes customer
-- names, phone numbers, emails, lead keys and CS remarks.

create table if not exists public.marketing_treatment_performance_daily (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null
    references public.marketing_data_sources(id) on delete cascade,
  brand_id uuid not null
    references public.brands(id) on delete cascade,
  metric_date date not null,
  metric_kind text not null,
  dimension_key text not null,
  brand_label text not null,
  treatment_label text not null,
  source_label text not null,
  campaign_label text not null,
  branch_label text not null,
  metric_count integer not null default 0 check (metric_count >= 0),
  source_updated_at timestamptz not null,
  imported_at timestamptz not null default now(),
  sync_run_id uuid not null,
  constraint marketing_treatment_performance_kind_check
    check (metric_kind in (
      'lead',
      'book',
      'show',
      'no_show',
      'pending_show'
    )),
  constraint marketing_treatment_performance_dimension_unique
    unique (
      data_source_id,
      metric_date,
      metric_kind,
      dimension_key
    )
);

create index if not exists marketing_treatment_performance_date_brand_kind_idx
  on public.marketing_treatment_performance_daily(
    metric_date,
    brand_id,
    metric_kind
  );

create index if not exists marketing_treatment_performance_brand_treatment_date_idx
  on public.marketing_treatment_performance_daily(
    brand_id,
    treatment_label,
    metric_date
  );

create index if not exists marketing_treatment_performance_source_run_idx
  on public.marketing_treatment_performance_daily(
    data_source_id,
    sync_run_id
  );

alter table public.marketing_treatment_performance_daily
  enable row level security;

revoke all on table public.marketing_treatment_performance_daily
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.marketing_treatment_performance_daily
  to service_role;

comment on table public.marketing_treatment_performance_daily is
  'Server-only anonymous treatment, source and campaign aggregates imported from the configured Lead Sheet. No customer-level fields are stored.';
comment on column public.marketing_treatment_performance_daily.metric_kind is
  'Date ownership: lead/book use Created At; show uses confirmed show date; no_show and pending_show use appointment date.';
comment on column public.marketing_treatment_performance_daily.dimension_key is
  'Deterministic SHA-256 key for the non-PII brand/treatment/source/campaign/branch dimension tuple.';

-- Alyssa Enterprise mappings stay in the source configuration rather than
-- becoming Growth OS Core constants. The analysis importer reads only the
-- `lead` tab and resolves columns by header name.
update public.marketing_data_sources
set
  configuration =
    (
      configuration
      - 'createdAtColumn'
      - 'followStatusColumn'
      - 'brandColumn'
      - 'bookingDateColumn'
      - 'confirmationDateColumn'
    )
    || jsonb_build_object(
      'lastColumn', 'V',
      'brandAliases', jsonb_build_object(
        'Alyssa', 'alyssa',
        'Ineffable', 'ineffable',
        'Ineffable Beauty', 'ineffable',
        'GOS', 'gos-beauty',
        'GOS Beauty', 'gos-beauty'
      ),
      'treatmentAliases', jsonb_build_array(
        jsonb_build_object(
          'brand', 'Ineffable Beauty',
          'label', '$388 柔清舒敏護理',
          'keywords', jsonb_build_array('柔清', '針清', 'gentle pore')
        ),
        jsonb_build_object(
          'brand', 'Ineffable Beauty',
          'label', '$588 DEP 無針水光 Combo',
          'keywords', jsonb_build_array('dep', '無針水光', 'nano')
        ),
        jsonb_build_object(
          'brand', 'Ineffable Beauty',
          'label', '$588 S-Lite 水感輕腿管理',
          'keywords', jsonb_build_array('s-lite', 'slite', '水感輕腿')
        ),
        jsonb_build_object(
          'brand', 'Ineffable Beauty',
          'label', '$780 BTL Exion 全面膠原提拉',
          'keywords', jsonb_build_array('btl', 'exion', '全面膠原')
        ),
        jsonb_build_object(
          'brand', 'Alyssa',
          'label', '$988 Facelift',
          'keywords', jsonb_build_array('facelift', 'face lift', '蔡思貝')
        ),
        jsonb_build_object(
          'brand', 'Alyssa',
          'label', '$780 SlimCut',
          'keywords', jsonb_build_array('slimcut', 'slim cut', 'sulin')
        ),
        jsonb_build_object(
          'brand', 'Alyssa',
          'label', 'Julaine 緻麗顏',
          'keywords', jsonb_build_array('julaine', 'poyi', 'kimi', '麗珠蘭')
        ),
        jsonb_build_object(
          'brand', 'Alyssa',
          'label', 'XEOMIN',
          'keywords', jsonb_build_array('xeomin', 'heihei')
        ),
        jsonb_build_object(
          'brand', 'Alyssa',
          'label', '$588 肌源28',
          'keywords', jsonb_build_array('肌源28', '肌源 28', 'jiyuan28')
        ),
        jsonb_build_object(
          'brand', 'Alyssa',
          'label', '$988 Face Pilates',
          'keywords', jsonb_build_array('face pilates')
        ),
        jsonb_build_object(
          'brand', 'GOS Beauty',
          'label', 'GOS 激光脫毛',
          'keywords', jsonb_build_array('激光脫毛', '永久脫毛', '兩年任脫')
        ),
        jsonb_build_object(
          'brand', 'GOS Beauty',
          'label', 'GOS 去斑・嫩膚・美白',
          'keywords', jsonb_build_array('去斑', '嫩膚', '美白')
        ),
        jsonb_build_object(
          'brand', 'GOS Beauty',
          'label', 'GOS 疣・癦・痣處理',
          'keywords', jsonb_build_array('脫疣', '疣', '癦', '痣')
        )
      )
    ),
  provides_metrics = array[
    'leads',
    'bookings',
    'shows',
    'no_shows',
    'pending_shows',
    'treatment_performance'
  ]::text[],
  updated_at = now()
where configuration ->> 'sourceProfile' =
  'alyssa_workspace_lead_funnel';
