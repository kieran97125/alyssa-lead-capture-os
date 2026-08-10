alter table public.marketing_report_snapshots
  rename column generated_by_email to generated_by_identifier;

comment on column public.marketing_report_snapshots.generated_by_identifier is
  'Non-email actor label; workspace member accountability uses generated_by_member_id.';
