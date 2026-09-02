-- Calendar edit link lookup indexes.
-- The edit RPC resolves linked Creative Jobs by calendar_item_id on every
-- full edit and drag operation. Keep that ownership lookup selective without
-- indexing soft-deleted history.

create index if not exists creative_jobs_calendar_item_active_idx
  on public.creative_jobs(calendar_item_id)
  where calendar_item_id is not null
    and deleted_at is null;
