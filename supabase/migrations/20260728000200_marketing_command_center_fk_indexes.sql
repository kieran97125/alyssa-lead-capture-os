-- Cover the foreign-key side of Marketing Command Center relationships.
-- These indexes keep brand deletion, source removal and joins efficient as
-- the calendar, audit and daily metric tables grow.

create index if not exists marketing_calendar_items_brand_id_idx
  on public.marketing_calendar_items(brand_id);

create index if not exists marketing_command_center_audit_brand_id_idx
  on public.marketing_command_center_audit(brand_id);

create index if not exists marketing_daily_metrics_data_source_id_idx
  on public.marketing_daily_metrics(data_source_id);

create index if not exists workspace_member_brand_access_brand_id_idx
  on public.workspace_member_brand_access(brand_id);
