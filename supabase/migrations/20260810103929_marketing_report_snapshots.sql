create table if not exists public.marketing_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_id text not null unique,
  generated_at timestamptz not null default now(),
  generated_by_member_id uuid null references public.workspace_members(id) on delete set null,
  generated_by_email text not null,
  start_date date not null,
  end_date date not null,
  brand_scope text not null,
  brand_ids uuid[] not null default '{}'::uuid[],
  comparison_json jsonb null,
  split_dimensions text[] not null default '{}'::text[],
  output_format text not null,
  metric_contract_version text not null,
  snapshot_json jsonb not null,
  data_quality_json jsonb not null,
  source_sync_json jsonb not null,
  snapshot_sha256 text not null,
  constraint marketing_report_snapshots_date_order_check
    check (start_date <= end_date),
  constraint marketing_report_snapshots_output_format_check
    check (output_format in ('pdf', 'pptx')),
  constraint marketing_report_snapshots_split_dimensions_check
    check (split_dimensions <@ array['brand', 'treatment']::text[]),
  constraint marketing_report_snapshots_sha256_check
    check (snapshot_sha256 ~ '^[0-9a-f]{64}$')
);

comment on table public.marketing_report_snapshots is
  'Immutable, non-PII aggregate snapshots used to generate Growth OS PDF and PPTX reports.';

create index if not exists marketing_report_snapshots_generated_at_idx
  on public.marketing_report_snapshots (generated_at desc);

create index if not exists marketing_report_snapshots_period_idx
  on public.marketing_report_snapshots (start_date, end_date);

create index if not exists marketing_report_snapshots_brand_ids_gin_idx
  on public.marketing_report_snapshots using gin (brand_ids);

alter table public.marketing_report_snapshots enable row level security;

revoke all on table public.marketing_report_snapshots from anon, authenticated;
revoke update, delete, truncate on table public.marketing_report_snapshots from service_role;
grant select, insert on table public.marketing_report_snapshots to service_role;

create or replace function public.reject_marketing_report_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'marketing_report_snapshots are immutable';
end;
$$;

revoke all on function public.reject_marketing_report_snapshot_mutation() from public;

drop trigger if exists marketing_report_snapshots_immutable on public.marketing_report_snapshots;
create trigger marketing_report_snapshots_immutable
before update or delete on public.marketing_report_snapshots
for each row execute function public.reject_marketing_report_snapshot_mutation();
