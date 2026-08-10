create index if not exists marketing_report_snapshots_generated_by_member_id_idx
  on public.marketing_report_snapshots (generated_by_member_id)
  where generated_by_member_id is not null;
