-- Cover the two nullable audit lineage/reviewer foreign keys used by
-- retention, cleanup and reviewer-scoped operations.

create index if not exists lead_sheet_audit_runs_previous_run_idx
  on public.lead_sheet_audit_runs(previous_run_id)
  where previous_run_id is not null;

create index if not exists lead_sheet_audit_changes_reviewed_by_member_idx
  on public.lead_sheet_audit_changes(reviewed_by_member_id)
  where reviewed_by_member_id is not null;
