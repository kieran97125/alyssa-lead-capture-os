revoke all on function public.audit_treatment_mapping_rule()
  from public, anon, authenticated;
revoke all on function public.refresh_treatment_mapping_cache_trigger()
  from public, anon, authenticated;

grant execute on function public.audit_treatment_mapping_rule()
  to service_role;
grant execute on function public.refresh_treatment_mapping_cache_trigger()
  to service_role;

comment on table public.treatment_mapping_rules is
  'Growth OS source of truth for Lead Sheet treatment normalization and Dashboard classification. Google Sheets may retain a historical rule tab, but it is not authoritative.';

comment on table public.marketing_report_snapshots is
  'Immutable, non-PII aggregate snapshots used to generate Growth OS PDF, PPTX and plain-text Dashboard reports.';
